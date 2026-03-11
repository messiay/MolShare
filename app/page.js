'use client'
import { useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, Box, Layers, Share2, Mail, Lock, AlertCircle } from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.push('/dashboard')
      }
    })
  }, [router])

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`
      }
    })
  }

  const handleEmailSignUp = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      }
    })
    
    if (error) {
      setError(error.message)
    } else {
      if (data?.session) {
        router.push('/dashboard')
      } else {
        setMessage('Registration successful! If you have email confirmation enabled, please check your inbox.')
      }
    }
    setLoading(false)
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="relative w-32 h-32 mx-auto mb-8">
            <Image
              src="/logo.png"
              alt="MolShare Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            MolShare V1.0 is Live
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900">
            Universal Storage for <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
              Biological Data
            </span>
          </h1>

          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Upload, visualize, and share your molecular structures in seconds.
            Supports <strong>.PDB, .SDF, .MOL2, .XYZ, .CIF</strong> and more.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#features" className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all shadow-sm">
              Learn More
            </a>
          </div>

          {/* Auth Section */}
          <div className="max-w-md mx-auto mt-12 bg-white p-8 rounded-2xl shadow-xl shadow-indigo-100 border border-indigo-50">
            
            {/* Reviewer Notice */}
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-left">
              <p className="text-sm font-semibold text-indigo-900 mb-1">Peer Reviewers (Application Note)</p>
              <p className="text-xs text-indigo-700">Feel free to create a new account below with any dummy email, or use the demo credentials provided in the manuscript: <br/><strong className="select-all">demo@molshare.com</strong> / <strong className="select-all">MolShare2025</strong></p>
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              {message && (
                <div className="p-3 text-sm text-emerald-600 bg-emerald-50 rounded-lg">
                  <p>{message}</p>
                </div>
              )}
              
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  required
                />
              </div>
              
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleEmailLogin}
                  disabled={loading || !email || !password}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shadow-indigo-500/20"
                >
                  {loading ? 'Working...' : 'Sign In'}
                </button>
                <button
                  type="button"
                  onClick={handleEmailSignUp}
                  disabled={loading || !email || !password}
                  className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-900 transition-all disabled:opacity-50 shadow-md shadow-slate-900/20"
                >
                  {loading ? 'Working...' : 'Sign Up'}
                </button>
              </div>
            </form>

            <div className="mt-6 flex items-center">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="px-4 text-sm text-slate-400">or optionally</span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="mt-6 w-full py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-3"
            >
              <Image src="https://www.google.com/favicon.ico" alt="Google" width={16} height={16} />
              Continue with Google
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: Box,
                title: "Universal Format Support",
                desc: "Don't worry about extensions. We handle PDB, SDF, MOL2, and many more out of the box."
              },
              {
                icon: Layers,
                title: "Interactive 3D Viewer",
                desc: "State-of-the-art WebGL viewer powered by 3Dmol.js to visualize structures directly in your browser."
              },
              {
                icon: Share2,
                title: "Instant Sharing",
                desc: "Generate public links for your projects and collaborate with notes and annotations."
              }
            ].map((feature, i) => (
              <div key={i} className="flex flex-col items-center text-center p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="p-4 bg-indigo-100 rounded-2xl text-indigo-600 mb-6">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
