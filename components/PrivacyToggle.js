'use client'
import { useState } from 'react'
import { supabase } from '@/utils/supabase'
import { Globe, Lock, ChevronDown, Check } from 'lucide-react'

export default function PrivacyToggle({ projectId, initialStatus, onUpdate }) {
    const [isPublic, setIsPublic] = useState(initialStatus)
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleToggle = async (newStatus) => {
        if (newStatus === isPublic) return
        setLoading(true)

        try {
            const { error } = await supabase
                .from('projects')
                .update({ is_public: newStatus })
                .eq('id', projectId)

            if (error) throw error

            setIsPublic(newStatus)
            if (onUpdate) onUpdate(newStatus)
            setIsOpen(false)
        } catch (error) {
            console.error('Error updating privacy:', error)
            alert('Failed to update privacy settings')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${isPublic
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                    }`}
            >
                {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                {isPublic ? 'Public' : 'Private'}
                <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full mt-1 right-0 w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1 z-20 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <button
                            onClick={() => handleToggle(false)}
                            disabled={loading}
                            className="flex items-center w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg text-left"
                        >
                            <Lock className="w-4 h-4 mr-2" />
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">Private link</div>
                                <div className="text-xs text-gray-500">Only you can view</div>
                            </div>
                            {!isPublic && <Check className="w-4 h-4 text-blue-600" />}
                        </button>

                        <div className="h-px bg-gray-50 my-1" />

                        <button
                            onClick={() => handleToggle(true)}
                            disabled={loading}
                            className="flex items-center w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg text-left"
                        >
                            <Globe className="w-4 h-4 mr-2" />
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">Public link</div>
                                <div className="text-xs text-gray-500">Anyone with link can view</div>
                            </div>
                            {isPublic && <Check className="w-4 h-4 text-blue-600" />}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
