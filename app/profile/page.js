'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User, Mail, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        async function getProfile() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/')
                return
            }

            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            setProfile(data)
            setLoading(false)
        }
        getProfile()
    }, [router])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto px-4 py-12">
            <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
            </Link>

            <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                <div className="flex items-center gap-6 mb-8">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                        <User className="w-8 h-8 text-gray-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
                        <p className="text-gray-500">Manage your account settings</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                        <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-600">
                            <Mail className="w-5 h-5" />
                            {profile?.email}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-gray-600 font-mono text-xs overflow-x-auto">
                            {profile?.id}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
