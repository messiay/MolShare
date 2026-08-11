'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Layers, Palette, Box, History, GitBranch, Loader2 } from 'lucide-react'

const representations = ['cartoon', 'stick', 'sphere', 'line', 'cross']

const colorSchemes = {
    'By Chain': 'chain',
    'By Element': 'element',
    'By Residue': 'residueindex',
    'By Secondary Structure': 'ssPyMOL',
    'White': 'white',
}

export default function MoleculeViewer({
    url,
    type,
    annotations = [],
    onAtomClick,
    versions = [],
    activeVersionId,
    onSelectVersion,
    onUploadNewVersion,
    uploadingVersion,
    isOwner
}) {
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
    const [surfaceOpacity, setSurfaceOpacity] = useState(0.7)

    const styleRef = useRef(currentStyle)
    const colorRef = useRef(currentColor)
    const surfaceOpacityRef = useRef(surfaceOpacity)
    styleRef.current = currentStyle
    colorRef.current = currentColor
    surfaceOpacityRef.current = surfaceOpacity

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
            const res = viewer.addSurface(
                $3Dmol.SurfaceType.VDW,
                { opacity: surfaceOpacity, colorscheme: 'whiteCarbon' }
            )
            surfaceIdRef.current = res?.surfid !== undefined ? res.surfid : res
            if (res && typeof res.then === 'function') {
                res.then((id) => {
                    surfaceIdRef.current = id
                    viewer.render()
                })
            }
            setSurfaceShowing(true)
        }
        viewer.render()
    }

    const changeSurfaceOpacity = (newOpacity) => {
        const val = Math.max(0.1, Math.min(1.0, parseFloat(newOpacity) || 0.7))
        setSurfaceOpacity(val)
        const viewer = viewerRef.current
        const $3Dmol = $3DmolRef.current
        if (!viewer || !$3Dmol || !surfaceShowing) return

        const surfId = surfaceIdRef.current
        if (surfId !== null && viewer.surfaces && viewer.surfaces[surfId]) {
            // Fast in-place material style update (0ms, no geometry recalculation)
            viewer.setSurfaceMaterialStyle(surfId, { opacity: val, colorscheme: 'whiteCarbon' })
            viewer.render()
        } else {
            viewer.removeAllSurfaces()
            const res = viewer.addSurface(
                $3Dmol.SurfaceType.VDW,
                { opacity: val, colorscheme: 'whiteCarbon' }
            )
            surfaceIdRef.current = res?.surfid !== undefined ? res.surfid : res
            if (res && typeof res.then === 'function') {
                res.then((id) => {
                    surfaceIdRef.current = id
                    viewer.render()
                })
            }
            viewer.render()
        }
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
        <div className="w-full h-full flex flex-col bg-gray-100 overflow-hidden">
            {/* Docked Top Workstation Toolbar */}
            {!error && (
                <div className="w-full bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0 z-10 shadow-xs overflow-x-auto scrollbar-hide flex-nowrap">
                    {/* Left: Version History & Upload New Version */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        {versions && versions.length > 0 && (
                            <div className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800 transition-colors">
                                <History className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                                <span className="font-semibold text-gray-600">Version:</span>
                                <select
                                    value={activeVersionId || ''}
                                    onChange={(e) => onSelectVersion && onSelectVersion(e.target.value)}
                                    className="bg-transparent text-gray-900 font-semibold text-sm outline-none cursor-pointer pr-1"
                                >
                                    {versions.map((v, idx) => (
                                        <option key={v.id} value={v.id}>
                                            Version {v.version_number || 1} {idx === versions.length - 1 && versions.length > 1 ? '(Latest)' : ''} — {v.created_at ? new Date(v.created_at).toLocaleDateString() : 'Initial'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {isOwner && onUploadNewVersion && (
                            <label className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer shadow-xs whitespace-nowrap">
                                {uploadingVersion ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                                ) : (
                                    <GitBranch className="w-4 h-4 text-indigo-600" />
                                )}
                                <span>{uploadingVersion ? 'Saving...' : 'Upload New Version'}</span>
                                <input
                                    type="file"
                                    accept=".pdb,.sdf,.mol2,.xyz,.cif,.cube,.pqr"
                                    className="hidden"
                                    onChange={onUploadNewVersion}
                                    disabled={uploadingVersion}
                                />
                            </label>
                        )}
                    </div>

                    {/* Right: 3D Visualization Controls */}
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                        {/* Style Selector */}
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800">
                            <Layers className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            <span className="text-gray-500 font-semibold text-xs uppercase tracking-wide">Style:</span>
                            <select
                                value={currentStyle}
                                onChange={(e) => changeRepresentation(e.target.value)}
                                className="bg-transparent text-gray-900 font-semibold text-sm outline-none cursor-pointer"
                            >
                                {representations.map(r => (
                                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                ))}
                            </select>
                        </div>

                        {/* Color Scheme Selector */}
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-800">
                            <Palette className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                            <span className="text-gray-500 font-semibold text-xs uppercase tracking-wide">Color:</span>
                            <select
                                value={currentColor}
                                onChange={(e) => changeColorScheme(e.target.value)}
                                className="bg-transparent text-gray-900 font-semibold text-sm outline-none cursor-pointer"
                            >
                                {Object.entries(colorSchemes).map(([label, value]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Surface Toggle Button */}
                        <button
                            id="surface-toggle-btn"
                            onClick={toggleSurface}
                            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition-all shadow-xs ${
                                surfaceShowing
                                    ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                            }`}
                        >
                            <Box className="w-4 h-4" />
                            <span>{surfaceShowing ? 'Hide Surface' : 'Show Surface'}</span>
                        </button>

                        {/* Opacity Slider */}
                        {surfaceShowing && (
                            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-1.5 text-sm text-indigo-900 animate-in fade-in duration-150">
                                <span className="font-semibold text-xs text-indigo-700">Opacity:</span>
                                <input
                                    id="surface-opacity-slider"
                                    type="range"
                                    min="0.1"
                                    max="1.0"
                                    step="0.05"
                                    value={surfaceOpacity}
                                    onChange={(e) => changeSurfaceOpacity(e.target.value)}
                                    className="w-20 h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                />
                                <span className="font-mono text-xs font-bold text-indigo-900 w-8 text-right">
                                    {Math.round(surfaceOpacity * 100)}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 3D Canvas Area */}
            <div className="flex-1 w-full h-full relative min-h-0">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 z-10">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                            <p className="text-xs font-mono text-gray-500 uppercase tracking-widest">Rendering 3D Structure...</p>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                        <div className="text-center p-6 max-w-md border border-red-200 bg-red-50 rounded-xl">
                            <h3 className="text-red-800 font-bold mb-2 font-mono uppercase text-xs">Error Loading Molecule</h3>
                            <p className="text-red-600 text-sm mb-4">{error}</p>
                        </div>
                    </div>
                )}

                <div
                    ref={containerRef}
                    className="w-full h-full"
                    style={{ cursor: onAtomClick ? 'crosshair' : 'default' }}
                />

                {/* Subtle atom annotation hint watermark */}
                {onAtomClick && (
                    <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur-sm border border-gray-200 text-[11px] text-gray-500 shadow-2xs pointer-events-none flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Click any atom to add annotation
                    </div>
                )}
            </div>
        </div>
    )
}

