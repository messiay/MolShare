'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/utils/supabase'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, FileType } from 'lucide-react'

export default function FileCarousel({ files, activeIndex, onSelect, isOwner, projectId, userId, onFilesUpdated }) {
    const scrollRef = useRef(null)
    const [uploading, setUploading] = useState(false)

    const scroll = (direction) => {
        if (scrollRef.current) {
            const amount = 200
            scrollRef.current.scrollBy({
                left: direction === 'left' ? -amount : amount,
                behavior: 'smooth'
            })
        }
    }

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

                // Insert into project_files
                const { error: dbError } = await supabase
                    .from('project_files')
                    .insert({
                        project_id: projectId,
                        owner_id: userId,
                        file_url: publicUrl,
                        file_extension: ext,
                        file_name: file.name,
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

    const handleRemoveFile = async (e, fileId, fileUrl) => {
        e.stopPropagation()
        if (files.length <= 1) {
            alert('Cannot remove the last file from a project.')
            return
        }
        if (!confirm('Remove this file from the project?')) return

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
        <div className="flex items-center gap-1 px-2 py-2 bg-white/90 backdrop-blur-sm border-b border-gray-200">
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
                className="flex items-center gap-2 overflow-x-auto scrollbar-hide flex-1"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {files.map((file, index) => (
                    <button
                        key={file.id}
                        onClick={() => onSelect(index)}
                        className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                            index === activeIndex
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                    >
                        <FileType className="w-4 h-4 flex-shrink-0" />
                        <span className="max-w-[140px] truncate">{file.file_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono uppercase ${
                            index === activeIndex
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'bg-gray-200 text-gray-500'
                        }`}>
                            {file.file_extension}
                        </span>
                        {isOwner && files.length > 1 && (
                            <span
                                onClick={(e) => handleRemoveFile(e, file.id, file.file_url)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </span>
                        )}
                    </button>
                ))}

                {/* Add Button */}
                {isOwner && (
                    <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 border border-dashed border-gray-300 hover:border-indigo-300 transition-all cursor-pointer flex-shrink-0 whitespace-nowrap">
                        {uploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        {uploading ? 'Uploading...' : 'Add File'}
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
    )
}
