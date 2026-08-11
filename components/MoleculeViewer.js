'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Layers, Palette, Box } from 'lucide-react'

const representations = ['cartoon', 'stick', 'sphere', 'line', 'cross']

const colorSchemes = {
    'By Chain': 'chain',
    'By Element': 'element',
    'By Residue': 'residueindex',
    'By Secondary Structure': 'ssPyMOL',
    'White': 'white',
}

export default function MoleculeViewer({ url, type, annotations = [], onAtomClick }) {
    const containerRef = useRef(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const viewerRef = useRef(null)
    const $3DmolRef = useRef(null)
    const surfaceIdRef = useRef(null)

    // Interactive visualization state
    const [currentStyle, setCurrentStyle] = useState('cartoon')
    const [currentColor, setCurrentColor] = useState('chain')
    const [surfaceShowing, setSurfaceShowing] = useState(false)

    const styleRef = useRef(currentStyle)
    const colorRef = useRef(currentColor)
    styleRef.current = currentStyle
    colorRef.current = currentColor

    // Combined style + color applicator
    const applyStyle = useCallback((style, color, viewerInstance = null) => {
        const viewer = viewerInstance || viewerRef.current
        if (!viewer) return

        const colorProp = color === 'white' ? { color: 'white' } : { colorscheme: color }
        const styleObj = {}

        if (style === 'stick') {
            styleObj.stick = { radius: 0.15, ...colorProp }
        } else if (style === 'sphere') {
            styleObj.sphere = { scale: 0.3, ...colorProp }
        } else if (style === 'cartoon') {
            styleObj.cartoon = { ...colorProp }
        } else if (style === 'line') {
            styleObj.line = { ...colorProp }
        } else if (style === 'cross') {
            styleObj.cross = { ...colorProp }
        } else {
            styleObj[style] = { ...colorProp }
        }

        // Apply primary style across whole molecule
        viewer.setStyle({}, styleObj)

        // Maintain ligand highlighting for HETATM / UNL
        viewer.setStyle({ hetflag: true }, { stick: { radius: 0.15, colorscheme: 'greenCarbon' }, sphere: { scale: 0.25 } })
        viewer.setStyle({ resn: 'UNL' }, { stick: { radius: 0.15, colorscheme: 'greenCarbon' }, sphere: { scale: 0.25 } })

        viewer.render()
    }, [])

    const changeRepresentation = (style) => {
        setCurrentStyle(style)
        applyStyle(style, currentColor)
    }

    const changeColorScheme = (scheme) => {
        setCurrentColor(scheme)
        applyStyle(currentStyle, scheme)
    }

    const toggleSurface = () => {
        const viewer = viewerRef.current
        const $3Dmol = $3DmolRef.current
        if (!viewer || !$3Dmol) return

        if (surfaceShowing) {
            viewer.removeAllSurfaces()
            surfaceIdRef.current = null
            setSurfaceShowing(false)
        } else {
            surfaceIdRef.current = viewer.addSurface(
                $3Dmol.SurfaceType.VDW,
                { opacity: 0.7, colorscheme: 'whiteCarbon' }
            )
            setSurfaceShowing(true)
        }
        viewer.render()
    }

    useEffect(() => {
        let isMounted = true
        let viewer = null
        if (!containerRef.current || !url) return

        setLoading(true)
        setError(null)
        setSurfaceShowing(false)
        surfaceIdRef.current = null

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
                const ext = type ? type.toLowerCase() : 'pdb'

                // Strip any END records to prevent 3Dmol.js from stopping early
                // when a combined receptor+ligand PDB is loaded
                const sanitizedData = data.replace(/^END\s*$/gm, '').trimEnd()

                // Load model
                viewer.addModel(sanitizedData, ext)

                // Conditional Styling default
                const isProtein = ['pdb', 'cif', 'mmtf', 'pqr', 'ent'].includes(ext)
                const initialStyle = isProtein ? styleRef.current : 'stick'
                if (!isProtein && styleRef.current === 'cartoon') {
                    setCurrentStyle('stick')
                }

                applyStyle(initialStyle, colorRef.current, viewer)

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
    }, [url, type, applyStyle])

    // Re-render markers when annotations change (without reloading the whole model)
    useEffect(() => {
        if (viewerRef.current && $3DmolRef.current && !loading) {
            renderAnnotationMarkers(viewerRef.current, annotations, $3DmolRef.current)
            viewerRef.current.render()
        }
    }, [annotations, loading])

    const renderAnnotationMarkers = (viewer, annotations, $3Dmol) => {
        // Remove existing labels and shapes
        viewer.removeAllLabels()
        viewer.removeAllShapes()

        // Group all annotations by atom_serial so we can show all comments per atom
        const atomGroups = new Map()
        annotations.forEach(ann => {
            if (ann.x == null || ann.y == null || ann.z == null) return
            if (!atomGroups.has(ann.atom_serial)) {
                atomGroups.set(ann.atom_serial, { meta: ann, comments: [] })
            }
            atomGroups.get(ann.atom_serial).comments.push(ann.content || '')
        })

        atomGroups.forEach(({ meta, comments }) => {
            // Build the label text: residue header + each comment on its own line
            const header = `💬 ${meta.residue_name || ''}${meta.residue_id || ''}`
            const commentLines = comments
                .filter(c => c.trim())
                .map(c => c.length > 40 ? c.slice(0, 37) + '...' : c)

            const labelText = commentLines.length > 0
                ? `${header}\n${commentLines.join('\n')}`
                : header

            // Add a label showing the comment text at the atom position
            viewer.addLabel(
                labelText,
                {
                    position: { x: meta.x, y: meta.y, z: meta.z },
                    backgroundColor: 'rgba(99, 102, 241, 0.92)',
                    fontColor: 'white',
                    fontSize: 11,
                    borderRadius: 8,
                    padding: 6,
                    showBackground: true,
                    backgroundOpacity: 0.92,
                    inFront: true
                }
            )

            // Highlight the atom with a translucent sphere
            viewer.addSphere({
                center: { x: meta.x, y: meta.y, z: meta.z },
                radius: 0.6,
                color: 'indigo',
                opacity: 0.35
            })
        })
    }

    return (
        <div className="relative w-full h-full bg-gray-100 overflow-hidden">
            {/* Interactive 3D Controls Toolbar */}
            {!loading && !error && (
                <div className="absolute top-4 right-4 z-10 flex flex-wrap items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl shadow-md border border-gray-200/80 text-xs transition-all">
                    {/* 1. Representation Selector */}
                    <div className="flex items-center gap-1.5 text-gray-700">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        <select
                            id="representation-selector"
                            value={currentStyle}
                            onChange={(e) => changeRepresentation(e.target.value)}
                            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer font-medium transition-colors"
                        >
                            {representations.map(r => (
                                <option key={r} value={r}>
                                    {r.charAt(0).toUpperCase() + r.slice(1)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Color Scheme Selector */}
                    <div className="flex items-center gap-1.5 text-gray-700 border-l border-gray-200 pl-2">
                        <Palette className="w-3.5 h-3.5 text-indigo-600" />
                        <select
                            id="colorscheme-selector"
                            value={currentColor}
                            onChange={(e) => changeColorScheme(e.target.value)}
                            className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs rounded-lg px-2 py-1 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer font-medium transition-colors"
                        >
                            {Object.entries(colorSchemes).map(([label, value]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Surface Toggle */}
                    <div className="border-l border-gray-200 pl-2">
                        <button
                            id="surface-toggle-btn"
                            onClick={toggleSurface}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                surfaceShowing
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm hover:bg-indigo-700'
                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                        >
                            <Box className="w-3.5 h-3.5" />
                            {surfaceShowing ? 'Hide Surface' : 'Show Surface'}
                        </button>
                    </div>
                </div>
            )}

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

