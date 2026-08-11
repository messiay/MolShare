'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/utils/supabase'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, FileType, GitBranch, History } from 'lucide-react'

export default function FileCarousel({ files, activeIndex, onSelect, isOwner, projectId, userId, onFilesUpdated }) {
    const scrollRef = useRef(null)
    const [uploading, setUploading] = useState(false)
    const [uploadingVersion, setUploadingVersion] = useState(false)

    const scroll = (direction) => {
        if (scrollRef.current) {
            const amount = 200
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -amount : amount,
                behavior: 'smooth'
            })
        }
    }

    const activeFile = files[activeIndex] || files[0]

    // Find all versions belonging to the active file's lineage
    const activeRootId = activeFile?.parent_version_id || activeFile?.id
    const activeLineage = files.filter(f => 
        (activeRootId && (f.id === activeRootId || f.parent_version_id === activeRootId)) ||
        (activeFile?.id && f.parent_version_id === activeFile.id) ||
        (activeFile?.parent_version_id && f.id === activeFile.parent_version_id) ||
        f.file_name === activeFile?.file_name
    ).sort((a, b) => (a.version_number || 1) - (b.version_number || 1))

    // Handle adding a brand new molecule file
    const handleAddFiles = async (e) => {
        const selectedFiles = Array.from(e.target.files || [])
        if (selectedFiles.length === 0) return

        setUploading(true)
        try {
            const timestamp = Date.now()
            const currentMaxOrder = files.length > 0
                ? Math.max(...files.map(f => f.sort_order || 0))
                : -1

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i]
                const ext = file.name.split('.').pop().toLowerCase()
                const sanitizedName = `${timestamp}_${i}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                const filePath = `${userId}/${sanitizedName}`

                // Upload to storage
                const { error: uploadError } = await supabase.storage
                    .from('molecules')
                    .upload(filePath, file)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('molecules')
                    .getPublicUrl(filePath)

                // Insert into project_files as version 1
                const { error: dbError } = await supabase
                    .from('project_files')
                    .insert({
                        project_id: projectId,
                        owner_id: userId,
                        file_url: publicUrl,
                        file_extension: ext,
                        file_name: file.name,
                        version_number: 1,
                        parent_version_id: null,
                        sort_order: currentMaxOrder + 1 + i
                    })

                if (dbError) throw dbError
            }

            if (onFilesUpdated) onFilesUpdated()
        } catch (error) {
            console.error(error)
            alert('Error uploading file(s): ' + error.message)
        } finally {
            setUploading(false)
            e.target.value = ''
        }
    }

    // Handle uploading a NEW VERSION of the current active file
    const handleUploadNewVersion = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !activeFile || !userId) return

        setUploadingVersion(true)
        try {
            const timestamp = Date.now()
            const ext = file.name.split('.').pop().toLowerCase()

            // Calculate next version number
            const currentMaxVersion = activeLineage.length > 0
                ? Math.max(...activeLineage.map(f => f.version_number || 1))
                : (activeFile.version_number || 1)
            const nextVersion = currentMaxVersion + 1

            // Versioned Supabase storage path (never overwrites original!)
            const sanitizedName = `${timestamp}_v${nextVersion}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const filePath = `${userId}/${sanitizedName}`

            // 1. Upload new version to storage
            const { error: uploadError } = await supabase.storage
                .from('molecules')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('molecules')
                .getPublicUrl(filePath)

            // 2. Insert new version record into project_files
            const rootId = activeFile.parent_version_id || activeFile.id
            const { data: newFileRecord, error: dbError } = await supabase
                .from('project_files')
                .insert({
                    project_id: projectId,
                    owner_id: userId,
                    file_url: publicUrl,
                    file_extension: ext,
                    file_name: file.name,
                    version_number: nextVersion,
                    parent_version_id: rootId !== 'legacy' ? rootId : null,
                    sort_order: activeFile.sort_order || 0
                })
                .select()
                .single()

            if (dbError) throw dbError

            alert(`Uploaded ${file.name} as Version ${nextVersion}!`)
            if (onFilesUpdated) {
                await onFilesUpdated(newFileRecord?.id)
            }
        } catch (error) {
            console.error(error)
            alert('Error uploading new version: ' + error.message)
        } finally {
            setUploadingVersion(false)
            e.target.value = ''
        }
    }

    const handleRemoveFile = async (e, fileId, fileUrl) => {
        e.stopPropagation()
        if (files.length <= 1) {
            alert('Cannot remove the last file from a project.')
            return
        }
        if (!confirm('Remove this file/version from the project?')) return

        try {
            // Remove from storage
            const path = fileUrl.split('/molecules/')[1]
            if (path) {
                await supabase.storage.from('molecules').remove([path])
            }

            // Remove from DB
            await supabase.from('project_files').delete().eq('id', fileId)

            if (onFilesUpdated) onFilesUpdated()
        } catch (error) {
            alert('Error removing file: ' + error.message)
        }
    }

    if (!files || files.length === 0) return null

    return (
        <div className="flex flex-col bg-white/90 backdrop-blur-sm border-b border-gray-200">
            {/* Top Bar: Carousel of Files & Add Button */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100">
                {/* Left Arrow */}
                <button
                    onClick={() => scroll('left')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Scrollable File Cards */}
                <div
                    ref={scrollRef}
                    className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1 py-0.5"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {files.map((file, index) => (
                        <button
                            key={file.id}
                            onClick={() => onSelect(index)}
                            className={`group relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                                index === activeIndex
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-800'
                            }`}
                        >
                            <FileType className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="max-w-[130px] truncate">{file.file_name}</span>
                            
                            {/* Version Badge */}
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                                index === activeIndex
                                    ? 'bg-indigo-200 text-indigo-800'
                                    : 'bg-gray-200 text-gray-600'
                            }`}>
                                v{file.version_number || 1}
                            </span>

                            <span className={`text-[9px] px-1 py-0.2 rounded uppercase font-mono ${
                                index === activeIndex
                                    ? 'text-indigo-500'
                                    : 'text-gray-400'
                            }`}>
                                {file.file_extension}
                            </span>

                            {isOwner && files.length > 1 && (
                                <span
                                    onClick={(e) => handleRemoveFile(e, file.id, file.file_url)}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer text-[10px]"
                                    title="Delete this file/version"
                                >
                                    <X className="w-2.5 h-2.5" />
                                </span>
                            )}
                        </button>
                    ))}

                    {/* Add Molecule Button */}
                    {isOwner && (
                        <label className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-dashed border-gray-300 hover:border-indigo-300 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap">
                            {uploading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Plus className="w-3.5 h-3.5" />
                            )}
                            {uploading ? 'Uploading...' : 'Add Molecule'}
                            <input
                                type="file"
                                multiple
                                accept=".pdb,.sdf,.mol2,.xyz,.cif,.cube,.pqr"
                                className="hidden"
                                onChange={handleAddFiles}
                                disabled={uploading}
                            />
                        </label>
                    )}
                </div>

                {/* Right Arrow */}
                <button
                    onClick={() => scroll('right')}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>

                {/* File Counter */}
                <span className="text-xs text-gray-400 font-mono flex-shrink-0 ml-1">
                    {activeIndex + 1}/{files.length}
                </span>
            </div>

            {/* Bottom Bar: Version Selector & New Version Upload for Current Active File */}
            <div className="flex items-center justify-between px-3 py-1 bg-gray-50/70 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-gray-700">
                        <History className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Version History:</span>
                    </div>

                    {/* Version Switcher Dropdown */}
                    <select
                        id="version-switcher"
                        value={activeFile?.id || ''}
                        onChange={(e) => {
                            const selectedIdx = files.findIndex(f => f.id === e.target.value)
                            if (selectedIdx !== -1) onSelect(selectedIdx)
                        }}
                        className="bg-white border border-gray-300 text-gray-800 text-xs rounded-md px-2 py-0.5 font-medium focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer"
                    >
                        {activeLineage.map((v, idx) => (
                            <option key={v.id} value={v.id}>
                                Version {v.version_number || 1} {idx === activeLineage.length - 1 && activeLineage.length > 1 ? '(Latest)' : ''} — {v.created_at ? new Date(v.created_at).toLocaleDateString() : 'Initial'}
                            </option>
                        ))}
                    </select>

                    <span className="text-[11px] text-gray-400">
                        ({activeLineage.length} {activeLineage.length === 1 ? 'version' : 'versions'} saved)
                    </span>
                </div>

                {/* Upload New Version Button */}
                {isOwner && (
                    <label className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 transition-all cursor-pointer shadow-2xs">
                        {uploadingVersion ? (
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                        ) : (
                            <GitBranch className="w-3 h-3 text-indigo-600" />
                        )}
                        <span>{uploadingVersion ? 'Saving Version...' : 'Upload New Version'}</span>
                        <input
                            type="file"
                            accept=".pdb,.sdf,.mol2,.xyz,.cif,.cube,.pqr"
                            className="hidden"
                            onChange={handleUploadNewVersion}
                            disabled={uploadingVersion}
                        />
                    </label>
                )}
            </div>
        </div>
    )
}

