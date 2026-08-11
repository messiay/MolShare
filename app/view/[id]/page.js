'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useParams, useRouter } from 'next/navigation'

import MoleculeViewer from '@/components/MoleculeViewer'
import CsvViewer from '@/components/CsvViewer'
import InteractionPanel from '@/components/InteractionPanel'
import FileCarousel from '@/components/FileCarousel'
import AtomAnnotationPopup from '@/components/AtomAnnotationPopup'
import { ArrowLeft, Download, Share2, Loader2, Database, Box, FileText, UploadCloud, Plus, Copy, Check, Link2 } from 'lucide-react'
import Link from 'next/link'

export default function ViewPage() {
    const { id } = useParams()
    const router = useRouter()
    const [project, setProject] = useState(null)
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [activeView, setActiveView] = useState('3d') // '3d' | 'csv'
    const [uploadingCsv, setUploadingCsv] = useState(false)
    const [showShareLink, setShowShareLink] = useState(false)
    const [copied, setCopied] = useState(false)

    const [ownerProfile, setOwnerProfile] = useState(null)

    // Multi-file state
    const [projectFiles, setProjectFiles] = useState([])
    const [activeFileIndex, setActiveFileIndex] = useState(0)

    // Annotation state
    const [annotations, setAnnotations] = useState([])
    const [clickedAtom, setClickedAtom] = useState(null)
    const [atomPopupPosition, setAtomPopupPosition] = useState({ x: 0, y: 0 })

    useEffect(() => {
        if (!id) return;
        getData()
    }, [id])

    async function getData() {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        // 1. Log View (include viewer_id for shared-with-me tracking)
        supabase.from('project_views').insert({ project_id: id, viewer_id: user?.id || null }).then(({ error }) => {
            if (error) console.error('Error logging view:', error)
        })

        const { data } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single()

        if (data) {
            setProject(data)

            // 2. Fetch Owner Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.owner_id)
                .single()

            if (profile) setOwnerProfile(profile)

            // 3. Fetch project files
            await fetchProjectFiles(data)

            // 4. Fetch annotations
            await fetchAnnotations()
        }
        setLoading(false)
    }

    async function fetchProjectFiles(projectData, targetFileId = null) {
        const proj = projectData || project
        const { data: files } = await supabase
            .from('project_files')
            .select('*')
            .eq('project_id', id)
            .order('sort_order', { ascending: true })
            .order('version_number', { ascending: true })

        if (files && files.length > 0) {
            setProjectFiles(files)
            if (targetFileId) {
                const targetIndex = files.findIndex(f => f.id === targetFileId)
                if (targetIndex !== -1) {
                    setActiveFileIndex(targetIndex)
                }
            }
        } else if (proj) {
            // Legacy fallback: use the single file_url from the project
            setProjectFiles([{
                id: 'legacy',
                file_url: proj.file_url,
                file_extension: proj.file_extension,
                file_name: proj.title,
                version_number: 1,
                sort_order: 0
            }])
        }
    }

    async function fetchAnnotations() {
        const { data, error } = await supabase
            .from('annotations')
            .select('*, profiles ( email, full_name )')
            .eq('project_id', id)
            .order('created_at', { ascending: true })

        if (!error && data) {
            setAnnotations(data)
        }
    }

    const handleCsvUpload = async (e) => {
        const file = e.target.files[0]
        if (!file || !user) return

        if (!file.name.endsWith('.csv')) {
            alert('Please upload a valid CSV file.')
            return
        }

        setUploadingCsv(true)
        try {
            const timestamp = Date.now()
            const csvFileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const csvFilePath = `${user.id}/${csvFileName}`

            const { error: uploadError } = await supabase.storage
                .from('molecules')
                .upload(csvFilePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('molecules')
                .getPublicUrl(csvFilePath)

            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    csv_file_url: publicUrl,
                    csv_file_name: file.name
                })
                .eq('id', project.id)

            if (updateError) throw updateError

            alert('CSV Data uploaded successfully!')
            getData()
            setActiveView('csv')

        } catch (error) {
            console.error(error)
            alert('Error uploading CSV: ' + error.message)
        } finally {
            setUploadingCsv(false)
        }
    }

    const handleAtomClick = (atomData, position) => {
        setClickedAtom(atomData)
        setAtomPopupPosition(position)
    }

    const handleCloseAtomPopup = () => {
        setClickedAtom(null)
    }

    const handleFilesUpdated = async (targetFileId = null) => {
        await fetchProjectFiles(project, targetFileId)
    }

    const handleAnnotationSaved = () => {
        fetchAnnotations()
    }

    const [uploadingVersion, setUploadingVersion] = useState(false)

    const handleUploadNewVersion = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !activeFile || !user) return

        setUploadingVersion(true)
        try {
            const timestamp = Date.now()
            const ext = file.name.split('.').pop().toLowerCase()

            // Calculate next version number
            const currentMaxVersion = activeLineage.length > 0
                ? Math.max(...activeLineage.map(f => f.version_number || 1))
                : (activeFile.version_number || 1)
            const nextVersion = currentMaxVersion + 1

            const sanitizedName = `${timestamp}_v${nextVersion}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
            const filePath = `${user.id}/${sanitizedName}`

            // 1. Upload to storage
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
                    project_id: project.id,
                    owner_id: user.id,
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
            await handleFilesUpdated(newFileRecord?.id)
        } catch (error) {
            console.error(error)
            alert('Error uploading new version: ' + error.message)
        } finally {
            setUploadingVersion(false)
            e.target.value = ''
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <p className="text-xs font-mono uppercase text-gray-500 tracking-wider">Loading project...</p>
            </div>
        )
    }

    if (!project) return null

    const isOwner = user?.id === project.owner_id

    const toggleShareLink = () => {
        setShowShareLink(prev => !prev)
        setCopied(false)
    }

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    // Get active file
    const activeFile = projectFiles[activeFileIndex] || projectFiles[0]

    // Find all versions belonging to the active file's lineage
    const activeRootId = activeFile?.parent_version_id || activeFile?.id
    const activeLineage = projectFiles.filter(f => 
        (activeRootId && (f.id === activeRootId || f.parent_version_id === activeRootId)) ||
        (activeFile?.id && f.parent_version_id === activeFile.id) ||
        (activeFile?.parent_version_id && f.id === activeFile.parent_version_id) ||
        f.file_name === activeFile?.file_name
    ).sort((a, b) => (a.version_number || 1) - (b.version_number || 1))

    // Filter annotations for the active file
    const activeFileAnnotations = annotations.filter(ann => {
        if (activeFile?.id === 'legacy') return !ann.file_id
        return ann.file_id === activeFile?.id
    })

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
            {/* Left Main Stage: Clean Top Nav & Canvas */}
            <div className="flex-1 relative bg-slate-100 flex flex-col min-w-0 overflow-hidden">
                {/* 1. Aligned Top Navigation Bar */}
                <div className="h-13 bg-white border-b border-gray-200 px-3 flex items-center justify-between gap-2.5 flex-shrink-0 z-20 shadow-2xs">
                    {/* Back link */}
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 transition-colors flex-shrink-0"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Repository</span>
                    </Link>

                    <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

                    {/* Horizontal File Carousel */}
                    {projectFiles.length > 0 && (
                        <FileCarousel
                            files={projectFiles}
                            activeIndex={activeFileIndex}
                            onSelect={setActiveFileIndex}
                            isOwner={isOwner}
                            projectId={project.id}
                            userId={user?.id}
                            onFilesUpdated={handleFilesUpdated}
                        />
                    )}

                    <div className="h-5 w-px bg-gray-200 flex-shrink-0" />

                    {/* View Switcher: 3D Structure vs Data Table */}
                    <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg border border-gray-200 flex-shrink-0">
                        <button
                            onClick={() => setActiveView('3d')}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                                activeView === '3d'
                                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <Box className="w-3.5 h-3.5 text-indigo-600" />
                            <span>3D Structure</span>
                        </button>

                        {project.csv_file_url ? (
                            <button
                                onClick={() => setActiveView('csv')}
                                className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                                    activeView === 'csv'
                                        ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Data Table</span>
                            </button>
                        ) : isOwner ? (
                            <label className="px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 text-gray-500 hover:text-indigo-600 hover:bg-white cursor-pointer transition-all">
                                {uploadingCsv ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                <span>Add CSV</span>
                                <input
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleCsvUpload}
                                    disabled={uploadingCsv}
                                />
                            </label>
                        ) : null}
                    </div>
                </div>

                {/* 2. Main Stage Content */}
                <div className="flex-1 w-full h-full relative min-h-0">
                    {activeView === '3d' ? (
                        <div className="w-full h-full relative">
                            <MoleculeViewer
                                url={activeFile?.file_url}
                                type={activeFile?.file_extension}
                                annotations={activeFileAnnotations}
                                onAtomClick={isOwner ? handleAtomClick : undefined}
                                versions={activeLineage}
                                activeVersionId={activeFile?.id}
                                onSelectVersion={(selectedId) => {
                                    const targetIdx = projectFiles.findIndex(f => f.id === selectedId)
                                    if (targetIdx !== -1) setActiveFileIndex(targetIdx)
                                }}
                                onUploadNewVersion={handleUploadNewVersion}
                                uploadingVersion={uploadingVersion}
                                isOwner={isOwner}
                            />

                            {/* Atom Annotation Popup */}
                            {clickedAtom && (
                                <AtomAnnotationPopup
                                    atomData={clickedAtom}
                                    position={atomPopupPosition}
                                    projectId={project.id}
                                    fileId={activeFile?.id !== 'legacy' ? activeFile?.id : null}
                                    user={user}
                                    isOwner={isOwner}
                                    onClose={handleCloseAtomPopup}
                                    onAnnotationSaved={handleAnnotationSaved}
                                />
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full p-4 overflow-auto">
                            <CsvViewer url={project.csv_file_url} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Project Metadata & Interactions */}
            <div className="w-[380px] flex flex-col border-l border-gray-200 bg-white flex-shrink-0">
                {/* Header Metadata Card */}
                <div className="p-5 border-b border-gray-200 bg-white space-y-4">
                    {/* Top Row: Format Badge & Action Buttons */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase">
                                {project.file_extension}
                            </span>
                            {project.is_public ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    Public
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                    Private
                                </span>
                            )}
                        </div>

                        {/* Action Buttons: Share & Download */}
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={toggleShareLink}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    showShareLink
                                        ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                                        : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                                }`}
                                title="Share project link"
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                <span>Share</span>
                            </button>

                            <a
                                href={activeFile?.file_url || project.file_url}
                                download
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium transition-all"
                                title="Download 3D Structure file"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Structure</span>
                            </a>
                        </div>
                    </div>

                    {/* Share Link Accordion */}
                    {showShareLink && (
                        <div className="p-2.5 bg-gray-50 border border-indigo-100 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium">
                                <span className="flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-indigo-600" />
                                    Shareable Link
                                </span>
                                <span>Anyone with link can view</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <input
                                    readOnly
                                    value={typeof window !== 'undefined' ? window.location.href : ''}
                                    className="flex-1 text-xs bg-white border border-gray-200 rounded-md px-2 py-1 text-gray-600 font-mono truncate outline-none focus:border-indigo-500"
                                    onClick={(e) => e.target.select()}
                                />
                                <button
                                    onClick={handleCopyLink}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
                                        copied
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-2xs'
                                    }`}
                                >
                                    {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 break-words tracking-tight leading-snug">
                            {project.title}
                        </h1>

                        {/* Owner & File Count Metadata */}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            {ownerProfile && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] text-white font-bold">
                                        {ownerProfile.email?.[0].toUpperCase() || 'U'}
                                    </div>
                                    <span className="truncate max-w-[170px] text-gray-700 font-medium">
                                        {ownerProfile.email}
                                    </span>
                                </div>
                            )}

                            {projectFiles.length > 1 && (
                                <div className="flex items-center gap-1 text-gray-400 font-medium">
                                    <Database className="w-3 h-3" />
                                    <span>{projectFiles.length} structures</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Interactive Panels: Notes, Comments & Annotations */}
                <div className="flex-1 overflow-hidden">
                    <InteractionPanel
                        projectId={project.id}
                        initialNotes={project.notes}
                        isOwner={isOwner}
                        user={user}
                        annotations={annotations}
                        onAnnotationDeleted={handleAnnotationSaved}
                    />
                </div>
            </div>
        </div>
    )
}
