'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import UploadZone from '@/components/UploadZone'
import PrivacyToggle from '@/components/PrivacyToggle'
import { FileText, Loader2, Trash2, Eye, MoreHorizontal, Layers, Link2 } from 'lucide-react'

export default function Dashboard() {
    const [projects, setProjects] = useState([])
    const [sharedProjects, setSharedProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    // Force rebuild for UI update

    const handleDelete = async (projectId, fileUrl, ownerId) => {
        if (!confirm('Are you sure you want to delete this project?')) return

        try {
            const path = fileUrl.split('/molecules/')[1]
            if (path) {
                const { error: storageError } = await supabase.storage
                    .from('molecules')
                    .remove([path])

                if (storageError) console.error('Storage delete error:', storageError)
            }

            const { error: dbError } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId)

            if (dbError) throw dbError

            setProjects(prev => prev.filter(p => p.id !== projectId))

        } catch (error) {
            alert('Error deleting project: ' + error.message)
        }
    }

    useEffect(() => {
        const fetchProjects = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }

            // JOIN on project_views to get count
            const { data } = await supabase
                .from('projects')
                .select('*, project_views(count), project_files(count)')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false })

            if (data) {
                // Flatten the counts for easier access
                const projectsWithCounts = data.map(p => ({
                    ...p,
                    view_count: p.project_views?.[0]?.count || 0,
                    file_count: p.project_files?.[0]?.count || 1
                }))
                setProjects(projectsWithCounts)
            }

            // Fetch projects shared with the user (visited but not owned)
            const { data: viewedData } = await supabase
                .from('project_views')
                .select('project_id, viewed_at, projects ( id, title, file_extension, owner_id, created_at, profiles:owner_id ( email, full_name ) )')
                .eq('viewer_id', user.id)
                .order('viewed_at', { ascending: false })

            if (viewedData) {
                // Deduplicate by project_id and exclude owned projects
                const seen = new Set()
                const shared = viewedData
                    .filter(v => v.projects && v.projects.owner_id !== user.id)
                    .filter(v => {
                        if (seen.has(v.project_id)) return false
                        seen.add(v.project_id)
                        return true
                    })
                    .map(v => ({
                        id: v.projects.id,
                        title: v.projects.title,
                        file_extension: v.projects.file_extension,
                        owner_email: v.projects.profiles?.email || 'Unknown',
                        owner_name: v.projects.profiles?.full_name || null,
                        last_viewed: v.viewed_at
                    }))
                setSharedProjects(shared)
            }

            setLoading(false)
        }

        fetchProjects()

        const channel = supabase
            .channel('realtime projects')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'projects' }, (payload) => {
                setProjects((prev) => [payload.new, ...prev])
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [router])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            <header className="flex items-center justify-between pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Repository</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage and view your molecular data</p>
                </div>
            </header>

            <section className="bg-white rounded-2xl border border-gray-200/60 p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-4 tracking-wide">Upload New Data</h2>
                <UploadZone />
            </section>

            <section className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead>
                            <tr>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">File Name</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Format</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Files</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Views</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Uploaded</th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Status</th>
                                <th scope="col" className="relative px-6 py-4">
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {projects.map((project) => (
                                <tr
                                    key={project.id}
                                    onClick={() => router.push(`/view/${project.id}`)}
                                    className="group hover:bg-gray-50/50 transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div className="text-sm font-medium text-gray-900">{project.title}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2.5 py-1 inline-flex text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                            {project.file_extension.toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="w-4 h-4 text-gray-400" />
                                            <span>{project.file_count}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex items-center gap-1.5">
                                            <Eye className="w-4 h-4 text-gray-400" />
                                            <span>{project.view_count || 0}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(project.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </td>

                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <PrivacyToggle
                                                projectId={project.id}
                                                initialStatus={project.is_public}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-sm">
                                                Open
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleDelete(project.id, project.file_url, project.owner_id)
                                                }}
                                                className="text-gray-400 hover:text-red-600 transition-colors p-1.5 hover:bg-red-50 rounded-full"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {projects.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-sm text-gray-500">
                                        No data available. Upload a file to get started.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Shared With Me Section */}
            {sharedProjects.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-200/60 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-blue-500" />
                        <h2 className="text-sm font-semibold text-gray-900 tracking-wide">Shared With Me</h2>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{sharedProjects.length}</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead>
                                <tr>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Project Name</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Format</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Shared By</th>
                                    <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-400 tracking-wider">Last Viewed</th>
                                    <th scope="col" className="relative px-6 py-4">
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {sharedProjects.map((sp) => (
                                    <tr
                                        key={sp.id}
                                        onClick={() => router.push(`/view/${sp.id}`)}
                                        className="group hover:bg-blue-50/30 transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3">
                                                    <Link2 className="h-5 w-5" />
                                                </div>
                                                <div className="text-sm font-medium text-gray-900">{sp.title}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 inline-flex text-xs font-medium rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                                {sp.file_extension.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0">
                                                    {sp.owner_email[0].toUpperCase()}
                                                </div>
                                                <span className="text-sm text-gray-600">{sp.owner_name || sp.owner_email.split('@')[0]}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(sp.last_viewed).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="text-blue-600 hover:text-blue-700 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:shadow-sm">
                                                    Open
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    )
}
