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

    async function fetchProjectFiles(projectData) {
        const proj = projectData || project
        const { data: files } = await supabase
            .from('project_files')
            .select('*')
            .eq('project_id', id)
            .order('sort_order', { ascending: true })

        if (files && files.length > 0) {
            setProjectFiles(files)
        } else if (proj) {
            // Legacy fallback: use the single file_url from the project
            setProjectFiles([{
                id: 'legacy',
                file_url: proj.file_url,
                file_extension: proj.file_extension,
                file_name: proj.title,
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

    const handleFilesUpdated = () => {
        fetchProjectFiles(project)
    }

    const handleAnnotationSaved = () => {
        fetchAnnotations()
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
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

    // Filter annotations for the active file
    const activeFileAnnotations = annotations.filter(ann => {
        if (activeFile?.id === 'legacy') return !ann.file_id
        return ann.file_id === activeFile?.id
    })

    return (
        <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-white">
            {/* Left Panel: 3D Stage / CSV Viewer */}
            <div className="flex-1 relative bg-gray-100 flex flex-col">
                {/* File Carousel */}
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

                <div className="absolute top-14 left-4 z-10 flex gap-2">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Repository
                    </Link>

                    {/* View Toggles */}
                    <div className="flex bg-white rounded shadow-sm border border-gray-200 p-1">
                        <button
                            onClick={() => setActiveView('3d')}
                            className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-all ${activeView === '3d' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-900'
                                }`}
                        >
                            <Box className="w-4 h-4" />
                            3D Structure
                        </button>

                        {project.csv_file_url ? (
                            <button
                                onClick={() => setActiveView('csv')}
                                className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-all ${activeView === 'csv' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                            >
                                <FileText className="w-4 h-4" />
                                Data Table
                            </button>
                        ) : isOwner ? (
                            <label className="px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition-all text-gray-500 hover:text-gray-900 hover:bg-gray-50 cursor-pointer">
                                {uploadingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Add Data (CSV)
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

                <div className="flex-1 w-full h-full relative">
                    {activeView === '3d' ? (
                        <div className="w-full h-full relative">
                            <MoleculeViewer
                                url={activeFile?.file_url}
                                type={activeFile?.file_extension}
                                annotations={activeFileAnnotations}
                                onAtomClick={isOwner ? handleAtomClick : undefined}
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
                        <div className="w-full h-full p-4 pt-16">
                            <CsvViewer url={project.csv_file_url} />
                        </div>
                    )}
                </div>
            </div>

            {/* Right Panel: Sidebar Information */}
            <div className="w-[400px] flex flex-col border-l border-gray-200 bg-white">

                {/* Header Metadata */}
                <div className="p-8 border-b border-gray-50 space-y-6">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                {project.file_extension.toUpperCase()}
                            </span>
                            <div className="flex flex-col gap-2 mt-4">
                                <div className="flex gap-2">
                                    <button onClick={toggleShareLink} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium ${showShareLink ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>
                                        <Share2 className="w-4 h-4" />
                                        Share
                                    </button>
                                    <a href={activeFile?.file_url || project.file_url} download className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors text-sm font-medium">
                                        <Download className="w-4 h-4" />
                                        Structure
                                    </a>
                                </div>
                                {showShareLink && (
                                    <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg animate-in fade-in slide-in-from-top-1 duration-200">
                                        <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        <input
                                            readOnly
                                            value={typeof window !== 'undefined' ? window.location.href : ''}
                                            className="flex-1 text-xs bg-transparent border-0 text-gray-600 focus:ring-0 font-mono truncate p-0"
                                            onClick={(e) => e.target.select()}
                                        />
                                        <button
                                            onClick={handleCopyLink}
                                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-shrink-0 ${copied
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                                                }`}
                                        >
                                            {copied ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                                        </button>
                                    </div>
                                )}
                                {project.csv_file_url && (
                                    <a href={project.csv_file_url} download className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors text-sm font-medium">
                                        <FileText className="w-4 h-4" />
                                        Download CSV Data
                                    </a>
                                )}
                                {isOwner && project.csv_file_url && (
                                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg transition-colors text-sm font-medium cursor-pointer">
                                        {uploadingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                                        Update CSV Data
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            onChange={handleCsvUpload}
                                            disabled={uploadingCsv}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 break-words tracking-tight leading-tight">{project.title}</h1>

                        {/* Shared By Badge */}
                        {ownerProfile && (
                            <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs text-white font-bold">
                                    {ownerProfile.email?.[0].toUpperCase() || 'U'}
                                </div>
                                <span>Shared by <span className="text-gray-900 font-medium">{ownerProfile.email}</span></span>
                            </div>
                        )}

                        {/* Multi-file info */}
                        {projectFiles.length > 1 && (
                            <div className="mt-3 text-xs text-gray-400 flex items-center gap-1">
                                <Database className="w-3 h-3" />
                                {projectFiles.length} structure files in this project
                            </div>
                        )}
                    </div>
                </div>


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
