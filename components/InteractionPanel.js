'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { Save, Lock, MessageSquare, StickyNote, Send, Trash2, Atom } from 'lucide-react'

// Helper to generate consistent avatar color from string (email/id)
const getAvatarColor = (str) => {
    const colors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500',
        'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500',
        'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500',
        'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
    ]
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
}

export default function InteractionPanel({ projectId, initialNotes, isOwner, user, annotations = [], onAnnotationDeleted }) {
    const [activeTab, setActiveTab] = useState('notes') // 'notes' | 'comments' | 'annotations'

    // Notes Logic
    const [notes, setNotes] = useState(initialNotes || '')
    const [savingNotes, setSavingNotes] = useState(false)

    const handleSaveNotes = async () => {
        if (!isOwner) return
        setSavingNotes(true)
        try {
            const { error } = await supabase.from('projects').update({ notes }).eq('id', projectId)
            if (error) throw error
        } catch (error) {
            alert('Failed to save notes')
        } finally {
            setSavingNotes(false)
        }
    }

    // Comments Logic
    const [comments, setComments] = useState([])
    const [newComment, setNewComment] = useState('')
    const [loadingComments, setLoadingComments] = useState(true)

    useEffect(() => {
        if (activeTab === 'comments') {
            fetchComments()

            const channel = supabase
                .channel('comments-' + projectId)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'comments',
                    filter: `project_id=eq.${projectId}`
                }, payload => {
                    if (payload.eventType === 'INSERT') {
                        fetchComments()
                    } else if (payload.eventType === 'DELETE') {
                        setComments(prev => prev.filter(c => c.id !== payload.old.id))
                    }
                })
                .subscribe()

            return () => {
                supabase.removeChannel(channel)
            }
        }
    }, [activeTab, projectId])

    const fetchComments = async () => {
        const { data, error } = await supabase
            .from('comments')
            .select(`
                *,
                profiles ( email, full_name, avatar_url )
            `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: true })

        if (!error && data) {
            setComments(data)
        }
        setLoadingComments(false)
    }

    const handlePostComment = async () => {
        if (!newComment.trim() || !user) return

        const { error } = await supabase
            .from('comments')
            .insert({
                project_id: projectId,
                user_id: user.id,
                content: newComment.trim()
            })

        if (!error) {
            setNewComment('')
            fetchComments()
        } else {
            alert('Failed to post comment')
        }
    }

    const handleDeleteComment = async (commentId) => {
        if (!confirm('Delete this comment?')) return
        await supabase.from('comments').delete().eq('id', commentId)
        fetchComments()
    }

    const handleDeleteAnnotation = async (annotationId) => {
        if (!confirm('Delete this annotation?')) return
        await supabase.from('annotations').delete().eq('id', annotationId)
        if (onAnnotationDeleted) onAnnotationDeleted()
    }

    // Group annotations by file
    const groupedAnnotations = annotations.reduce((groups, ann) => {
        const key = ann.file_id || 'legacy'
        if (!groups[key]) groups[key] = []
        groups[key].push(ann)
        return groups
    }, {})

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Tab Header */}
            <div className="px-4 border-b border-gray-100 flex items-center gap-4 bg-white overflow-x-auto">
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'notes'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <StickyNote className="w-4 h-4" />
                    Notes
                </button>
                <button
                    onClick={() => setActiveTab('comments')}
                    className={`py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'comments'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <MessageSquare className="w-4 h-4" />
                    Discussion
                </button>
                <button
                    onClick={() => setActiveTab('annotations')}
                    className={`py-4 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${activeTab === 'annotations'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Atom className="w-4 h-4" />
                    Annotations
                    {annotations.length > 0 && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-mono">
                            {annotations.length}
                        </span>
                    )}
                </button>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {/* NOTES TAB */}
                {activeTab === 'notes' && (
                    <div className="h-full flex flex-col">
                        {!isOwner && (
                            <div className="px-6 py-2 bg-gray-50/50 border-b border-gray-50 text-xs text-gray-500 flex items-center gap-2">
                                <Lock className="w-3 h-3" />
                                Only the owner can edit these notes.
                            </div>
                        )}
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={!isOwner}
                            className={`w-full h-full p-6 text-base text-gray-700 bg-white border-0 focus:ring-0 resize-none leading-relaxed ${!isOwner ? 'cursor-default' : ''
                                }`}
                            placeholder={isOwner ? "Add your research notes..." : "No notes recorded."}
                        />
                        {isOwner && (
                            <div className="absolute bottom-6 right-6">
                                <button
                                    onClick={handleSaveNotes}
                                    disabled={savingNotes}
                                    className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 text-sm font-medium"
                                >
                                    <Save className="w-4 h-4" />
                                    {savingNotes ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* COMMENTS TAB */}
                {activeTab === 'comments' && (
                    <div className="h-full flex flex-col">
                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {comments.length === 0 && !loadingComments && (
                                <div className="text-center py-10 text-gray-400 text-sm">
                                    No comments yet. Start the conversation!
                                </div>
                            )}

                            {comments.map((comment) => {
                                const isMyComment = user?.id === comment.user_id
                                const canDelete = isMyComment || isOwner
                                const authorName = comment.profiles?.email?.split('@')[0] || 'Unknown'
                                const avatarColor = getAvatarColor(comment.user_id)

                                return (
                                    <div key={comment.id} className="flex gap-3 group">
                                        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs text-white font-bold ${avatarColor}`}>
                                            {authorName[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {comment.profiles?.full_name || authorName}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {new Date(comment.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-r-xl rounded-bl-xl">
                                                {comment.content}
                                            </div>
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDeleteComment(comment.id)}
                                                    className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    Delete
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Input */}
                        <div className="p-4 border-t border-gray-100 bg-white">
                            {user ? (
                                <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                    <textarea
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        placeholder="Type a comment..."
                                        className="w-full bg-transparent border-0 focus:ring-0 text-sm p-2 max-h-32 resize-none"
                                        rows="1"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handlePostComment()
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handlePostComment}
                                        disabled={!newComment.trim()}
                                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 transition-colors"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center text-sm text-gray-500 py-2">
                                    Sign in to join the discussion.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ANNOTATIONS TAB */}
                {activeTab === 'annotations' && (
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {annotations.length === 0 ? (
                                <div className="text-center py-10">
                                    <Atom className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                    <p className="text-gray-400 text-sm">No annotations yet.</p>
                                    <p className="text-gray-400 text-xs mt-1">Click on an atom in the 3D viewer to add one.</p>
                                </div>
                            ) : (
                                Object.entries(groupedAnnotations).map(([fileKey, anns]) => (
                                    <div key={fileKey} className="space-y-3">
                                        {anns.map((ann) => {
                                            const authorName = ann.profiles?.full_name || ann.profiles?.email?.split('@')[0] || 'Unknown'
                                            const canDelete = user?.id === ann.user_id || isOwner

                                            return (
                                                <div key={ann.id} className="group bg-gray-50 rounded-xl p-3 border border-gray-100 hover:border-indigo-200 transition-colors">
                                                    {/* Atom Badge */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-semibold">
                                                                <Atom className="w-3 h-3" />
                                                                {ann.residue_name || 'UNK'}-{ann.residue_id || '?'}
                                                                {ann.chain ? ` · ${ann.chain}` : ''}
                                                            </span>
                                                            <span className="text-[10px] text-gray-400 font-mono">
                                                                {ann.atom_name} #{ann.atom_serial}
                                                            </span>
                                                        </div>
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => handleDeleteAnnotation(ann.id)}
                                                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all p-1"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Content */}
                                                    <p className="text-sm text-gray-700 leading-relaxed">{ann.content}</p>

                                                    {/* Author & Date */}
                                                    <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                                                        <span className="font-medium">{authorName}</span>
                                                        <span>{new Date(ann.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
