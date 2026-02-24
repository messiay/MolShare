'use client'
import { useEffect, useRef, useState } from 'react'

export default function MoleculeViewer({ url, type, annotations = [], onAtomClick }) {
    const containerRef = useRef(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const viewerRef = useRef(null)
    const $3DmolRef = useRef(null)

    useEffect(() => {
        let isMounted = true
        let viewer = null
        if (!containerRef.current || !url) return

        setLoading(true)
        setError(null)

        // Clear previous viewer
        containerRef.current.innerHTML = ''

        let $3Dmol

        // Dynamic import to avoid SSR "window is not defined" error
        import('3dmol').then((module) => {
            if (!isMounted || !containerRef.current) return Promise.reject(new Error('unmounted'))

            $3Dmol = module
            $3DmolRef.current = $3Dmol

            // Initialize viewer
            const config = { backgroundColor: 'white' }
            viewer = $3Dmol.createViewer(containerRef.current, config)
            viewerRef.current = viewer

            // Fetch the molecule file
            return fetch(url)
        })
            .then((res) => {
                if (!isMounted) return Promise.reject(new Error('unmounted'))
                if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`)
                return res.text()
            })
            .then((data) => {
                if (!isMounted) return
                if (!data) throw new Error('File is empty')
                if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
                    throw new Error('File validation failed (Received HTML instead of molecule data). Check file URL access.')
                }

                // Sanitize type
                const ext = type.toLowerCase()

                // Load model
                viewer.addModel(data, ext)

                // Conditional Styling
                const isProtein = ['pdb', 'cif', 'mmtf', 'pqr', 'ent'].includes(ext)

                if (isProtein) {
                    viewer.setStyle({}, { cartoon: { color: 'spectrum' }, stick: {} })
                } else {
                    viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } })
                }

                // Set up atom click handler
                if (onAtomClick) {
                    viewer.setClickable({}, true, (atom, viewerInstance, event, container) => {
                        const rect = containerRef.current.getBoundingClientRect()
                        onAtomClick(
                            {
                                serial: atom.serial,
                                atom: atom.atom,
                                elem: atom.elem,
                                resn: atom.resn,
                                resi: atom.resi,
                                chain: atom.chain,
                                x: atom.x,
                                y: atom.y,
                                z: atom.z
                            },
                            {
                                x: (event?.clientX || 0) - rect.left,
                                y: (event?.clientY || 0) - rect.top
                            }
                        )
                    })
                }

                // Render annotation markers
                renderAnnotationMarkers(viewer, annotations, $3Dmol)

                viewer.zoomTo()
                viewer.render()
                setLoading(false)
            })
            .catch((err) => {
                if (err.message === 'unmounted') return
                console.error('Error loading molecule:', err)
                if (isMounted) {
                    setError(err.message)
                    setLoading(false)
                }
            })

        return () => {
            isMounted = false
        }
    }, [url, type])

    // Re-render markers when annotations change (without reloading the whole model)
    useEffect(() => {
        if (viewerRef.current && $3DmolRef.current && !loading) {
            renderAnnotationMarkers(viewerRef.current, annotations, $3DmolRef.current)
            viewerRef.current.render()
        }
    }, [annotations, loading])

    const renderAnnotationMarkers = (viewer, annotations, $3Dmol) => {
        // Remove existing labels
        viewer.removeAllLabels()

        // Get unique annotated atoms by serial
        const uniqueAtoms = new Map()
        annotations.forEach(ann => {
            if (!uniqueAtoms.has(ann.atom_serial)) {
                uniqueAtoms.set(ann.atom_serial, ann)
            }
        })

        uniqueAtoms.forEach((ann) => {
            if (ann.x != null && ann.y != null && ann.z != null) {
                // Add a small label at the atom position
                viewer.addLabel(
                    `💬 ${ann.residue_name || ''}${ann.residue_id || ''}`,
                    {
                        position: { x: ann.x, y: ann.y, z: ann.z },
                        backgroundColor: 'rgba(99, 102, 241, 0.9)',
                        fontColor: 'white',
                        fontSize: 10,
                        borderRadius: 6,
                        padding: 4,
                        showBackground: true
                    }
                )

                // Highlight the atom with a sphere
                viewer.addSphere({
                    center: { x: ann.x, y: ann.y, z: ann.z },
                    radius: 0.6,
                    color: 'indigo',
                    opacity: 0.35
                })
            }
        })
    }

    return (
        <div className="relative w-full h-full bg-gray-100 overflow-hidden">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 z-10">
                    <div className="flex flex-col items-center gap-2">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Rendering...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                    <div className="text-center p-6 max-w-md border border-red-200 bg-red-50 rounded">
                        <h3 className="text-red-800 font-bold mb-2 font-mono uppercase text-xs">Error</h3>
                        <p className="text-red-600 text-sm mb-4">{error}</p>
                    </div>
                </div>
            )}
            <div
                ref={containerRef}
                className="w-full h-full"
                style={{ cursor: onAtomClick ? 'crosshair' : 'default' }}
            />
        </div>
    )
}
