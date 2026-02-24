'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/utils/supabase'
import { X, Send, Loader2, Atom, MapPin, Trash2 } from 'lucide-react'

export default function AtomAnnotationPopup({
    atomData,
    position,
    projectId,
    fileId,
    user,
    isOwner,
    onClose,
    onAnnotationSaved
}) {
    const [content, setContent] = useState('')
    const [saving, setSaving] = useState(false)
    const [annotations, setAnnotations] = useState([])
    const [loading, setLoading] = useState(true)
    const popupRef = useRef(null)

    // Fetch existing annotations for this atom
    useEffect(() => {
        if (!atomData) return
        fetchAnnotations()
    }, [atomData])

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [onClose])

    const fetchAnnotations = async () => {
        setLoading(true)
        let query = supabase
            .from('annotations')
            .select('*, profiles ( email, full_name )')
            .eq('project_id', projectId)
            .eq('atom_serial', atomData.serial)

        if (fileId) {
            query = query.eq('file_id', fileId)
        }

        const { data, error } = await query.order('created_at', { ascending: true })

        if (!error && data) {
            setAnnotations(data)
        }
        setLoading(false)
    }

    const handleSave = async () => {
        if (!content.trim() || !user) return

        setSaving(true)
        try {
            const { error } = await supabase
                .from('annotations')
                .insert({
                    project_id: projectId,
                    file_id: fileId || null,
                    user_id: user.id,
                    atom_serial: atomData.serial,
                    atom_name: atomData.atom,
                    residue_name: atomData.resn,
                    residue_id: atomData.resi,
                    chain: atomData.chain,
                    x: atomData.x,
                    y: atomData.y,
                    z: atomData.z,
                    content: content.trim()
                })

            if (error) throw error

            setContent('')
            fetchAnnotations()
            if (onAnnotationSaved) onAnnotationSaved()
        } catch (error) {
            alert('Failed to save annotation: ' + error.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (annotationId) => {
        if (!confirm('Delete this annotation?')) return
        await supabase.from('annotations').delete().eq('id', annotationId)
        fetchAnnotations()
        if (onAnnotationSaved) onAnnotationSaved()
    }

    if (!atomData) return null

    // Position the popup near the click point
    const popupStyle = {
        position: 'absolute',
        left: Math.min(position.x + 12, window.innerWidth - 340),
        top: Math.min(position.y - 20, window.innerHeight - 400),
        zIndex: 50
    }

    return (
        <div ref={popupRef} style={popupStyle} className="w-[320px] bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 text-white">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <Atom className="w-4 h-4" />
                        <span className="font-bold text-sm">
                            {atomData.resn || 'UNK'}-{atomData.resi || '?'}
                            {atomData.chain ? ` · Chain ${atomData.chain}` : ''}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-3 text-xs text-white/80">
                    <span>Atom: <strong className="text-white">{atomData.atom || '?'}</strong></span>
                    <span>Serial: <strong className="text-white">#{atomData.serial}</strong></span>
                    <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        ({atomData.x?.toFixed(1)}, {atomData.y?.toFixed(1)}, {atomData.z?.toFixed(1)})
                    </span>
                </div>
            </div>

            {/* Annotations List */}
            <div className="max-h-[200px] overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center p-6">
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                ) : annotations.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-400">
                        No annotations on this atom yet.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {annotations.map((ann) => {
                            const authorName = ann.profiles?.full_name || ann.profiles?.email?.split('@')[0] || 'Unknown'
                            const canDelete = user?.id === ann.user_id || isOwner

                            return (
                                <div key={ann.id} className="px-4 py-3 group hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-gray-700">{authorName}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(ann.created_at).toLocaleDateString()}
                                            </span>
                                            {canDelete && (
                                                <button
                                                    onClick={() => handleDelete(ann.id)}
                                                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 leading-relaxed">{ann.content}</p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Input */}
            {user ? (
                <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-end gap-2">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Add annotation..."
                            className="flex-1 text-sm bg-white border border-gray-200 rounded-lg p-2 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            rows="2"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSave()
                                }
                            }}
                        />
                        <button
                            onClick={handleSave}
                            disabled={saving || !content.trim()}
                            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-300 transition-colors flex-shrink-0"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-3 border-t border-gray-100 text-center text-xs text-gray-400">
                    Sign in to add annotations.
                </div>
            )}
        </div>
    )
}
