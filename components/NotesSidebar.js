'use client'
import { useState } from 'react'
import { supabase } from '@/utils/supabase'
import { Save, Lock } from 'lucide-react'

export default function NotesSidebar({ projectId, initialNotes, isOwner }) {
    const [notes, setNotes] = useState(initialNotes || '')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        if (!isOwner) return
        setSaving(true)
        try {
            const { error } = await supabase
                .from('projects')
                .update({ notes })
                .eq('id', projectId)

            if (error) throw error
        } catch (error) {
            alert('Failed to save notes')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="px-8 py-4 border-b border-gray-50 flex items-center justify-between bg-white">
                <h2 className="text-sm font-semibold text-gray-900">
                    Notes
                </h2>
                {!isOwner && (
                    <span className="text-xs flex items-center gap-1 text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                        <Lock className="w-3 h-3" /> Read Only
                    </span>
                )}
            </div>

            <div className="flex-1 p-0">
                {isOwner ? (
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-full p-8 text-base text-gray-700 bg-white border-0 focus:ring-0 resize-none placeholder:text-gray-300 leading-relaxed"
                        placeholder="Add your research notes..."
                    />
                ) : (
                    <div className="w-full h-full p-8 text-base text-gray-700 bg-white overflow-auto leading-relaxed">
                        {notes || <span className="text-gray-300">No notes recorded.</span>}
                    </div>
                )}
            </div>

            {isOwner && (
                <div className="p-6 border-t border-gray-50 bg-white">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-gray-900 rounded-xl hover:bg-black disabled:opacity-50 transition-all shadow-sm active:scale-[0.98]"
                    >
                        {saving ? 'Saving...' : 'Save Notes'}
                    </button>
                </div>
            )}
        </div>
    )
}
