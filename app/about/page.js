import Link from 'next/link'
import { ArrowRight, Shield, Share2, Box } from 'lucide-react'

export default function AboutPage() {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="relative overflow-hidden bg-gray-50 py-20 sm:py-32">
                <div className="container mx-auto px-6 relative z-10">
                    <div className="max-w-3xl mx-auto text-center">
                        <h1 className="text-4xl sm:text-6xl font-extrabold text-gray-900 tracking-tight mb-6">
                            Welcome to <span className="text-blue-600">BioCloud</span>
                        </h1>
                        <p className="text-xl text-gray-600 mb-10 leading-relaxed">
                            The universal platform for visualizing, storing, and sharing your biological discoveries.
                            Bring your molecular data to life with our seamless and secure tools.
                        </p>
                        <div className="flex justify-center gap-4">
                            <Link href="/dashboard" className="inline-flex items-center justify-center px-8 py-3 text-base font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-200">
                                Get Started
                                <ArrowRight className="ml-2 w-5 h-5" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Abstract Background Decoration */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-300 rounded-full blur-[100px]"></div>
                    <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-purple-200 rounded-full blur-[120px]"></div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Why BioCloud?</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">
                            Everything you need to manage your structural biology data in one place.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12">
                        {/* Feature 1 */}
                        <div className="p-8 bg-gray-50 rounded-2xl transition-all hover:shadow-md">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                                <Box className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Universal Visualization</h3>
                            <p className="text-gray-600 leading-relaxed">
                                Upload `.pdb`, `.sdf`, `.mol2` and other formats. Our viewer instantly renders detailed 3D models of your molecules, proteins, and chemical structures directly in the browser.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-8 bg-gray-50 rounded-2xl transition-all hover:shadow-md">
                            <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-6">
                                <Shield className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Secure Storage</h3>
                            <p className="text-gray-600 leading-relaxed">
                                Your data is sensitive and valuable. We use industry-standard encryption to ensure your files are stored safely in the cloud, accessible only by you.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-8 bg-gray-50 rounded-2xl transition-all hover:shadow-md">
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6">
                                <Share2 className="w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-3">Easy Sharing</h3>
                            <p className="text-gray-600 leading-relaxed">
                                Collaborate effortlessly. Generate secure links to your projects and share your findings with colleagues or the world with just a single click.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How to Use Section */}
            <section className="py-20 bg-gray-900 text-white">
                <div className="container mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">How It Works</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Getting started with BioCloud is simple.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 text-center px-4">
                        <div className="relative group">
                            <div className="text-6xl font-bold text-gray-800 mb-4 group-hover:text-blue-500 transition-colors">1</div>
                            <h3 className="text-xl font-bold mb-2">Create an Account</h3>
                            <p className="text-sm text-gray-400">Sign in securely to create your personal workspace.</p>
                        </div>
                        <div className="relative group">
                            <div className="text-6xl font-bold text-gray-800 mb-4 group-hover:text-blue-500 transition-colors">2</div>
                            <h3 className="text-xl font-bold mb-2">Upload Data</h3>
                            <p className="text-sm text-gray-400">Drag and drop your biological files into the upload zone.</p>
                        </div>
                        <div className="relative group">
                            <div className="text-6xl font-bold text-gray-800 mb-4 group-hover:text-blue-500 transition-colors">3</div>
                            <h3 className="text-xl font-bold mb-2">Visualize & Share</h3>
                            <p className="text-sm text-gray-400">Interact with your models in 3D and share them via link.</p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
