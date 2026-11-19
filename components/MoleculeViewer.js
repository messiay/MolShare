'use client'
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
    Layers, Palette, Box, History, GitBranch, Loader2, SlidersHorizontal,
    ChevronDown, ChevronRight, ChevronLeft, ChevronUp, Crosshair, Ruler,
    MessageSquarePlus, Sparkles, Eye, EyeOff, Play, Pause, RotateCcw,
    ZoomIn, ZoomOut, Move, Dna, Zap, Trash2, Scissors, CopyPlus
} from 'lucide-react'
import {
    analyzeStructureHierarchy,
    computeBindingPocketInteractions,
    parseMolecularDataAndPoses,
    getScientificAtomColor,
    calcDistance,
    WATER_RESIDUES,
    ION_RESIDUES
} from '@/utils/molAnalyzer'

const representations = [
    { value: 'cartoon', label: 'Cartoon' },
    { value: 'stick', label: 'Licorice / Stick' },
    { value: 'ballstick', label: 'Ball & Stick' },
    { value: 'sphere', label: 'Sphere (VDW)' },
    { value: 'line', label: 'Wireframe / Line' },
    { value: 'cross', label: 'Cross' }
]

const colorSchemes = {
    'By Chain': 'chain',
    'By Element (CPK)': 'element',
    'By Residue Index': 'residueindex',
    'Secondary Structure': 'ssPyMOL',
    'AlphaFold pLDDT': 'plddt',
    'B-Factor (Thermal)': 'bfactor',
    'Hydrophobicity (Kyte-Doolittle)': 'hydrophobicity',
    'Electrostatic Potential': 'charge',
    'Pure White': 'white'
}

const SCIENTIFIC_SCHEMES = new Set(['plddt', 'bfactor', 'hydrophobicity', 'charge'])
const LIGAND_RESN_LIST = ['UNL', 'LIG', 'MOL', 'UNK', 'DRG', 'INH', 'L1', 'L2', 'L3', 'NAG', 'HEM', 'ATP', 'GTP', 'NAD', 'FAD', 'SAM', 'SAH']
const WATER_RESN_LIST = Array.from(WATER_RESIDUES)
const ION_RESN_LIST = Array.from(ION_RESIDUES)

const OVERLAY_PALETTE = ['#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6']

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
    isOwner,
    allProjectFiles = [],
    externalFocusAtom = null,
    onLogEvent,
    restoreSnapshot = null
}) {
    const containerRef = useRef(null)
    const hoverBadgeRef = useRef(null)
    const viewerRef = useRef(null)
    const $3DmolRef = useRef(null)
    const primaryModelRef = useRef(null)
    const surfaceIdRef = useRef(null)
    const overlayModelsRef = useRef(new Map())

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Core visualization state
    const [currentStyle, setCurrentStyle] = useState('cartoon')
    const [currentColor, setCurrentColor] = useState('chain')
    const [controlsCollapsed, setControlsCollapsed] = useState(false)
    const [cameraCollapsed, setCameraCollapsed] = useState(false)

    // Surface state
    const [surfaceShowing, setSurfaceShowing] = useState(false)
    const [surfaceType, setSurfaceType] = useState('VDW') // 'VDW' | 'SAS' | 'SES'
    const [surfaceScope, setSurfaceScope] = useState('full') // 'full' | 'pocket' | 'ligand'
    const [surfaceColorMode, setSurfaceColorMode] = useState('white')
    const [surfaceOpacity, setSurfaceOpacity] = useState(0.7)

    // Interaction / Click Mode: 'pivot' | 'annotate' | 'distance'
    const [clickMode, setClickMode] = useState('pivot')

    // Smart Pivot & Camera State
    const [lockedPivot, setLockedPivot] = useState(null)
    const [isSpinning, setIsSpinning] = useState(false)
    const [slabEnabled, setSlabEnabled] = useState(false)
    const [slabNear, setSlabNear] = useState(-50)
    const [slabFar, setSlabFar] = useState(50)

    // Hierarchy, 1D Sequence & Visibility Layers (Hidden by default until 1D Seq is clicked)
    const [hierarchy, setHierarchy] = useState({
        chains: [],
        ligands: [],
        waterCount: 0,
        ionCount: 0,
        minB: 0,
        maxB: 100
    })
    const [selectedSeqChain, setSelectedSeqChain] = useState('A')
    const [selectedResidueKey, setSelectedResidueKey] = useState(null)
    const [showSequenceBar, setShowSequenceBar] = useState(false)
    const [activeDrawer, setActiveDrawer] = useState(null) // null | 'layers' | 'contacts' | 'measurements' | 'surface'

    // Per-Layer Visibility & Custom Style Overrides
    const [hiddenChains, setHiddenChains] = useState({})
    const [chainStyles, setChainStyles] = useState({})
    const [hiddenLigands, setHiddenLigands] = useState({})
    const [showWaters, setShowWaters] = useState(false)
    const [showIons, setShowIons] = useState(true)

    // Binding Pocket & Non-Covalent Interactions State
    const [pocketMode, setPocketMode] = useState(false)
    const [pocketCutoff, setPocketCutoff] = useState(4.5)
    const [activeLigandKey, setActiveLigandKey] = useState('ALL')
    const [showInteractionLines, setShowInteractionLines] = useState(true)
    const [pocketData, setPocketData] = useState({ pocketResidues: [], interactions: [] })

    // Interatomic Distance Measurements State
    const [pendingMeasureAtoms, setPendingMeasureAtoms] = useState([])
    const [measurements, setMeasurements] = useState([])

    // Multi-Pose / Docking Conformations State
    const [poses, setPoses] = useState([])
    const [activePoseIndex, setActivePoseIndex] = useState(0)
    const [posePlaying, setPosePlaying] = useState(false)
    const [showAllPoses, setShowAllPoses] = useState(false)
    const rawParsedRef = useRef({ sanitizedData: '', allPosesCombinedData: '', poses: [], ext: 'pdb' })

    // Multi-Structure File Overlay State
    const [overlayFileIds, setOverlayFileIds] = useState({})

    // Refs to keep callbacks up to date inside 3Dmol event handlers
    const stateRef = useRef({})
    stateRef.current = {
        currentStyle,
        currentColor,
        clickMode,
        lockedPivot,
        hierarchy,
        hiddenChains,
        chainStyles,
        hiddenLigands,
        showWaters,
        showIons,
        pocketMode,
        pocketCutoff,
        activeLigandKey,
        showInteractionLines,
        pocketData,
        measurements,
        pendingMeasureAtoms,
        annotations,
        slabEnabled,
        slabNear,
        slabFar,
        surfaceShowing,
        surfaceType,
        surfaceScope,
        surfaceColorMode,
        surfaceOpacity,
        onLogEvent,
        onAtomClick
    }

    const lastLoggedViewRef = useRef(null)
    const settleTimerRef = useRef(null)

    // Build and emit a meaningful inspection milestone with full 3D camera & state snapshot
    const emitLogMilestone = useCallback((category, title, detail = '') => {
        const viewer = viewerRef.current
        const cb = stateRef.current.onLogEvent
        if (!viewer || !cb) return

        let viewMatrix = null
        try {
            const v = viewer.getView()
            if (Array.isArray(v) && v.length >= 8) {
                viewMatrix = v.map(n => Number(n) || 0)
                lastLoggedViewRef.current = viewMatrix
            }
        } catch {
            // fallback
        }

        const st = stateRef.current
        const pivotCoords = st.lockedPivot && st.lockedPivot.x != null
            ? `Pivot: (${Number(st.lockedPivot.x).toFixed(1)}, ${Number(st.lockedPivot.y).toFixed(1)}, ${Number(st.lockedPivot.z).toFixed(1)})`
            : 'Pivot: Origin'
        const camTelemetry = viewMatrix
            ? `${pivotCoords} · Zoom: ${Math.abs(viewMatrix[3]).toFixed(1)} · Rot: [${viewMatrix[4].toFixed(2)}, ${viewMatrix[5].toFixed(2)}, ${viewMatrix[6].toFixed(2)}, ${viewMatrix[7].toFixed(2)}]`
            : pivotCoords

        cb({
            id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            timestamp: new Date().toISOString(),
            category,
            title,
            detail: detail || `${st.currentStyle} · ${st.currentColor}${st.pocketMode ? ` · Pocket ${st.pocketCutoff}Å` : ''}${st.surfaceShowing ? ` · ${st.surfaceType} Surface` : ''}`,
            telemetry: camTelemetry,
            snapshot: {
                viewMatrix,
                currentStyle: st.currentStyle,
                currentColor: st.currentColor,
                pocketMode: st.pocketMode,
                pocketCutoff: st.pocketCutoff,
                lockedPivot: st.lockedPivot,
                surfaceShowing: st.surfaceShowing,
                surfaceType: st.surfaceType,
                surfaceScope: st.surfaceScope,
                surfaceColorMode: st.surfaceColorMode,
                surfaceOpacity: st.surfaceOpacity,
                hiddenChains: st.hiddenChains,
                chainStyles: st.chainStyles,
                hiddenLigands: st.hiddenLigands,
                showWaters: st.showWaters,
                showIons: st.showIons,
                measurements: st.measurements
            }
        })
    }, [])

    // Restore 3D camera & visual state when user clicks a row in the View Log tab
    useEffect(() => {
        if (!restoreSnapshot || loading || !viewerRef.current) return
        const snap = restoreSnapshot.snapshot || restoreSnapshot
        const viewer = viewerRef.current

        if (snap.manualPinRequest) {
            emitLogMilestone('pin', snap.title || 'Pinned Camera Viewpoint')
            return
        }

        if (snap.currentStyle) setCurrentStyle(snap.currentStyle)
        if (snap.currentColor) setCurrentColor(snap.currentColor)
        if (typeof snap.pocketMode === 'boolean') setPocketMode(snap.pocketMode)
        if (typeof snap.pocketCutoff === 'number') setPocketCutoff(snap.pocketCutoff)
        if (snap.lockedPivot !== undefined) {
            stateRef.current.lockedPivot = snap.lockedPivot
            setLockedPivot(snap.lockedPivot)
        }
        if (snap.hiddenChains) setHiddenChains(snap.hiddenChains)
        if (snap.chainStyles) setChainStyles(snap.chainStyles)
        if (snap.hiddenLigands) setHiddenLigands(snap.hiddenLigands)
        if (typeof snap.showWaters === 'boolean') setShowWaters(snap.showWaters)
        if (typeof snap.showIons === 'boolean') setShowIons(snap.showIons)
        if (Array.isArray(snap.measurements)) {
            stateRef.current.measurements = snap.measurements
            setMeasurements(snap.measurements)
        }

        if (Array.isArray(snap.viewMatrix) && snap.viewMatrix.length >= 8) {
            lastLoggedViewRef.current = snap.viewMatrix
            viewer.setView(snap.viewMatrix, 250)
            if (!stateRef.current.slabEnabled) {
                viewer.setSlab(-1500, 1500)
            }
            viewer.render()
        }
    }, [restoreSnapshot, loading, emitLogMilestone])

    const getColorSpec = useCallback((scheme, minB = 0, maxB = 100) => {
        if (scheme === 'white') return { color: 'white' }
        if (SCIENTIFIC_SCHEMES.has(scheme)) {
            return {
                colorfunc: (atom) => getScientificAtomColor(atom, scheme, minB, maxB)
            }
        }
        return { colorscheme: scheme }
    }, [])

    const buildStyleObj = useCallback((styleName, colorSpec) => {
        if (styleName === 'stick') {
            return { stick: { radius: 0.16, ...colorSpec } }
        }
        if (styleName === 'ballstick') {
            return {
                stick: { radius: 0.14, ...colorSpec },
                sphere: { scale: 0.26, ...colorSpec }
            }
        }
        if (styleName === 'sphere') {
            return { sphere: { scale: 0.85, ...colorSpec } }
        }
        if (styleName === 'line') {
            return { line: { linewidth: 2.0, ...colorSpec } }
        }
        if (styleName === 'cross') {
            return { cross: { radius: 0.15, ...colorSpec } }
        }
        return { cartoon: { ...colorSpec } }
    }, [])

    // Render all 3D Shapes & Labels (Annotations + Locked Pivot Ring + Non-Covalent Bonds + Distance Rulers)
    const renderAllOverlays = useCallback((viewerInstance = null) => {
        const viewer = viewerInstance || viewerRef.current
        const $3Dmol = $3DmolRef.current
        if (!viewer || !$3Dmol) return

        const {
            annotations: curAnnotations,
            lockedPivot: curPivot,
            pocketMode: curPocketMode,
            showInteractionLines: curShowInt,
            pocketData: curPocketData,
            measurements: curMeasurements,
            pendingMeasureAtoms: curPending
        } = stateRef.current

        viewer.removeAllLabels()
        viewer.removeAllShapes()

        // 1. Render Saved Spatial Annotations
        const atomGroups = new Map()
        ;(curAnnotations || []).forEach(ann => {
            if (ann.x == null || ann.y == null || ann.z == null) return
            if (!atomGroups.has(ann.atom_serial)) {
                atomGroups.set(ann.atom_serial, { meta: ann, comments: [] })
            }
            atomGroups.get(ann.atom_serial).comments.push(ann.content || '')
        })

        atomGroups.forEach(({ meta, comments }) => {
            const header = `💬 ${meta.residue_name || ''}${meta.residue_id || ''}`
            const commentLines = comments
                .filter(c => c.trim())
                .map(c => c.length > 40 ? c.slice(0, 37) + '...' : c)

            const labelText = commentLines.length > 0
                ? `${header}\n${commentLines.join('\n')}`
                : header

            viewer.addLabel(labelText, {
                position: { x: meta.x, y: meta.y, z: meta.z },
                backgroundColor: 'rgba(79, 70, 229, 0.92)',
                fontColor: 'white',
                fontSize: 11,
                borderRadius: 8,
                padding: 6,
                showBackground: true,
                backgroundOpacity: 0.92,
                inFront: true
            })

            viewer.addSphere({
                center: { x: meta.x, y: meta.y, z: meta.z },
                radius: 0.65,
                color: '#6366f1',
                opacity: 0.38
            })
        })

        // 2. Render Locked Pivot Target Indicator
        if (curPivot && curPivot.x != null) {
            viewer.addSphere({
                center: { x: curPivot.x, y: curPivot.y, z: curPivot.z },
                radius: 0.5,
                color: '#10b981',
                opacity: 0.55
            })
            viewer.addLabel(`🎯 ${curPivot.label}`, {
                position: { x: curPivot.x, y: curPivot.y, z: curPivot.z },
                backgroundColor: 'rgba(5, 150, 105, 0.92)',
                fontColor: 'white',
                fontSize: 10,
                borderRadius: 6,
                padding: 4,
                showBackground: true,
                inFront: true
            })
        }

        // 3. Render Binding Pocket Residue Labels & Non-Covalent Interaction Dashed Cylinders
        if (curPocketMode && curPocketData) {
            curPocketData.pocketResidues.slice(0, 18).forEach(res => {
                if (!res.repAtom) return
                viewer.addLabel(`${res.resn}-${res.resi}`, {
                    position: { x: res.repAtom.x, y: res.repAtom.y, z: res.repAtom.z },
                    backgroundColor: 'rgba(15, 23, 42, 0.78)',
                    fontColor: '#f8fafc',
                    fontSize: 10,
                    borderRadius: 4,
                    padding: 3,
                    showBackground: true,
                    inFront: true
                })
            })
        }

        if ((curPocketMode || curShowInt) && curShowInt && curPocketData?.interactions?.length > 0) {
            curPocketData.interactions.forEach(inter => {
                const p = inter.proteinAtom
                const l = inter.ligandAtom
                if (!p || !l) return
                viewer.addCylinder({
                    start: { x: p.x, y: p.y, z: p.z },
                    end: { x: l.x, y: l.y, z: l.z },
                    radius: 0.07,
                    color: inter.color || '#06b6d4',
                    dashed: true,
                    fromCap: 1,
                    toCap: 1
                })
                if (curPocketMode) {
                    viewer.addLabel(`${inter.distance} Å`, {
                        position: {
                            x: (p.x + l.x) / 2,
                            y: (p.y + l.y) / 2,
                            z: (p.z + l.z) / 2
                        },
                        backgroundColor: inter.color || '#06b6d4',
                        fontColor: 'white',
                        fontSize: 9,
                        borderRadius: 4,
                        padding: 2,
                        showBackground: true,
                        inFront: true
                    })
                }
            })
        }

        // 4. Render Interatomic Distance Measurements
        ;(curMeasurements || []).forEach(m => {
            const pts = m.atoms || []
            for (let i = 0; i < pts.length - 1; i++) {
                viewer.addCylinder({
                    start: { x: pts[i].x, y: pts[i].y, z: pts[i].z },
                    end: { x: pts[i + 1].x, y: pts[i + 1].y, z: pts[i + 1].z },
                    radius: 0.08,
                    color: '#f59e0b',
                    dashed: true,
                    fromCap: 1,
                    toCap: 1
                })
            }
            pts.forEach(pt => {
                viewer.addSphere({
                    center: { x: pt.x, y: pt.y, z: pt.z },
                    radius: 0.35,
                    color: '#f59e0b',
                    opacity: 0.85
                })
            })
            if (m.midpoint) {
                viewer.addLabel(`${m.type}: ${m.valueText}`, {
                    position: m.midpoint,
                    backgroundColor: 'rgba(217, 119, 6, 0.95)',
                    fontColor: 'white',
                    fontSize: 11,
                    borderRadius: 6,
                    padding: 4,
                    showBackground: true,
                    inFront: true
                })
            }
        })

        // Highlight pending measurement click point
        ;(curPending || []).forEach((pt, idx) => {
            viewer.addSphere({
                center: { x: pt.x, y: pt.y, z: pt.z },
                radius: 0.42,
                color: '#ec4899',
                opacity: 0.9
            })
            viewer.addLabel(`#${idx + 1} ${pt.resn || ''}${pt.resi || ''}.${pt.atom || pt.elem}`, {
                position: { x: pt.x, y: pt.y, z: pt.z },
                backgroundColor: 'rgba(219, 39, 119, 0.92)',
                fontColor: 'white',
                fontSize: 10,
                borderRadius: 5,
                padding: 3,
                showBackground: true,
                inFront: true
            })
        })
    }, [])

    // Master Style & Layer Applicator
    const applyMasterSceneStyle = useCallback((viewerInstance = null) => {
        const viewer = viewerInstance || viewerRef.current
        const model = primaryModelRef.current || viewer
        if (!viewer || !model) return

        const {
            currentStyle: style,
            currentColor: color,
            hierarchy: hier,
            hiddenChains: hidChains,
            chainStyles: cStyles,
            hiddenLigands: hidLigs,
            showWaters: watersOn,
            showIons: ionsOn,
            pocketMode: isPocket,
            pocketData: pData
        } = stateRef.current

        const colorSpec = getColorSpec(color, hier.minB, hier.maxB)

        if (hier.chains && hier.chains.length > 0) {
            hier.chains.forEach(ch => {
                if (hidChains[ch.id]) {
                    model.setStyle({ chain: ch.id, hetflag: false }, {})
                } else {
                    const effectiveStyle = cStyles[ch.id] || style
                    const baseStyleObj = buildStyleObj(effectiveStyle, colorSpec)
                    if (isPocket && baseStyleObj.cartoon) {
                        baseStyleObj.cartoon.opacity = 0.28
                    }
                    model.setStyle({ chain: ch.id, hetflag: false }, baseStyleObj)
                }
            })
        } else {
            model.setStyle({}, buildStyleObj(style, colorSpec))
        }

        if (isPocket && pData?.pocketResidues?.length > 0) {
            // Batch pocket residues by chain into a single setStyle call per chain
            const byChain = {}
            pData.pocketResidues.forEach(res => {
                if (hidChains[res.chain]) return
                if (!byChain[res.chain]) byChain[res.chain] = []
                byChain[res.chain].push(res.resi)
            })
            Object.entries(byChain).forEach(([chId, resiList]) => {
                model.setStyle(
                    { chain: chId, resi: resiList },
                    {
                        cartoon: { opacity: 0.45, ...colorSpec },
                        stick: { radius: 0.18, colorscheme: 'cyanCarbon' },
                        sphere: { scale: 0.22, colorscheme: 'cyanCarbon' }
                    }
                )
            })
        }

        if (selectedResidueKey) {
            const [selChain, selResiStr] = selectedResidueKey.split(':')
            const selResi = Number(selResiStr)
            if (!hidChains[selChain]) {
                model.setStyle(
                    { chain: selChain, resi: selResi },
                    {
                        cartoon: { ...colorSpec },
                        stick: { radius: 0.24, colorscheme: 'magentaCarbon' },
                        sphere: { scale: 0.3, colorscheme: 'magentaCarbon' }
                    }
                )
            }
        }

        // Batched ligand, water, and ion styling (1 pass each instead of 37 separate loops!)
        model.setStyle({ hetflag: true }, { stick: { radius: 0.22, colorscheme: 'greenCarbon' }, sphere: { scale: 0.28 } })
        model.setStyle({ resn: LIGAND_RESN_LIST }, { stick: { radius: 0.22, colorscheme: 'greenCarbon' }, sphere: { scale: 0.28 } })

        if (hier.ligands && hier.ligands.length > 0) {
            hier.ligands.forEach(lig => {
                if (hidLigs[lig.key]) {
                    model.setStyle({ chain: lig.chain, resi: lig.resi, resn: lig.resn }, {})
                }
            })
        }

        model.setStyle(
            { resn: WATER_RESN_LIST },
            watersOn ? { sphere: { scale: 0.25, color: '#38bdf8', opacity: 0.75 } } : {}
        )

        model.setStyle(
            { resn: ION_RESN_LIST },
            ionsOn ? { sphere: { scale: 0.55, color: '#a855f7' } } : {}
        )

        renderAllOverlays(viewer)
        if (!stateRef.current.slabEnabled) {
            viewer.setSlab(-1500, 1500)
        }
        viewer.render()
    }, [buildStyleObj, getColorSpec, renderAllOverlays, selectedResidueKey])

    // Only rebuild 3D protein/ligand geometry when structural style or visibility actually changes
    useEffect(() => {
        if (!loading && viewerRef.current) {
            const raf = requestAnimationFrame(() => {
                applyMasterSceneStyle()
            })
            return () => cancelAnimationFrame(raf)
        }
    }, [
        currentStyle,
        currentColor,
        hiddenChains,
        chainStyles,
        hiddenLigands,
        showWaters,
        showIons,
        pocketMode,
        pocketData,
        selectedResidueKey,
        loading,
        applyMasterSceneStyle
    ])

    // Fast overlay-only redraw (<2ms) when pivot, distance measurements, or interaction lines change
    useEffect(() => {
        if (!loading && viewerRef.current) {
            renderAllOverlays(viewerRef.current)
            viewerRef.current.render()
        }
    }, [
        showInteractionLines,
        lockedPivot,
        measurements,
        pendingMeasureAtoms,
        loading,
        renderAllOverlays
    ])

    useEffect(() => {
        const model = primaryModelRef.current
        if (!model || loading) return
        const allAtoms = model.selectedAtoms({}) || []
        let targetLigAtoms = []

        if (activeLigandKey === 'ALL') {
            targetLigAtoms = hierarchy.ligands.flatMap(l => l.atoms)
        } else {
            const found = hierarchy.ligands.find(l => l.key === activeLigandKey)
            if (found) targetLigAtoms = found.atoms
        }

        const computed = computeBindingPocketInteractions(allAtoms, targetLigAtoms, pocketCutoff)
        setPocketData(computed)
    }, [hierarchy, pocketCutoff, activeLigandKey, loading, activePoseIndex])

    const lockPivotAndFocus = useCallback((selectionSpec, label, coords = null, shouldFitZoom = false) => {
        const viewer = viewerRef.current
        const model = primaryModelRef.current || viewer
        if (!viewer || !model) return

        const matchedAtoms = model.selectedAtoms(selectionSpec) || []
        if (matchedAtoms.length === 0 && !coords) return

        let targetX = coords?.x
        let targetY = coords?.y
        let targetZ = coords?.z

        if (targetX == null && matchedAtoms.length > 0) {
            let sx = 0, sy = 0, sz = 0
            matchedAtoms.forEach(a => {
                sx += a.x || 0
                sy += a.y || 0
                sz += a.z || 0
            })
            targetX = sx / matchedAtoms.length
            targetY = sy / matchedAtoms.length
            targetZ = sz / matchedAtoms.length
        }

        if (shouldFitZoom) {
            viewer.zoomTo(selectionSpec, 0)
        } else {
            viewer.center(selectionSpec, 0)
        }

        if (!stateRef.current.slabEnabled) {
            viewer.setSlab(-1500, 1500)
        }

        const nextPivot = {
            label,
            x: targetX,
            y: targetY,
            z: targetZ,
            selectionSpec
        }
        stateRef.current.lockedPivot = nextPivot
        setLockedPivot(nextPivot)
        renderAllOverlays(viewer)
        viewer.render()
        emitLogMilestone('pivot', `Focused Pivot: ${label}`)
    }, [renderAllOverlays, emitLogMilestone])

    const resetCameraPivot = useCallback(() => {
        const viewer = viewerRef.current
        if (!viewer) return
        stateRef.current.lockedPivot = null
        setLockedPivot(null)
        setSelectedResidueKey(null)
        viewer.zoomTo({}, 0)
        if (!stateRef.current.slabEnabled) {
            viewer.setSlab(-1500, 1500)
        }
        renderAllOverlays(viewer)
        viewer.render()
        emitLogMilestone('pivot', 'Reset View to Full Structure')
    }, [renderAllOverlays, emitLogMilestone])

    useEffect(() => {
        if (!externalFocusAtom || loading) return
        const label = `${externalFocusAtom.resn || 'ATOM'}-${externalFocusAtom.resi || ''}${externalFocusAtom.atom ? '.' + externalFocusAtom.atom : ''}`
        const spec = externalFocusAtom.serial
            ? { serial: externalFocusAtom.serial }
            : { chain: externalFocusAtom.chain, resi: externalFocusAtom.resi }
        lockPivotAndFocus(spec, label, {
            x: externalFocusAtom.x,
            y: externalFocusAtom.y,
            z: externalFocusAtom.z
        }, false)
    }, [externalFocusAtom, loading, lockPivotAndFocus])

    // Handle Atom Click based on active Click Mode ('pivot', 'annotate', 'distance')
    const handleCanvasAtomClick = useCallback((atom, event) => {
        if (!atom || !containerRef.current) return
        const mode = stateRef.current.clickMode
        const atomInfo = {
            serial: atom.serial,
            atom: atom.atom,
            elem: atom.elem,
            resn: atom.resn,
            resi: atom.resi,
            chain: atom.chain,
            b: atom.b,
            x: atom.x,
            y: atom.y,
            z: atom.z
        }

        if (mode === 'pivot') {
            const label = `${atom.resn || 'ATM'}-${atom.resi || ''} (${atom.atom || atom.elem})`
            lockPivotAndFocus({ serial: atom.serial }, label, { x: atom.x, y: atom.y, z: atom.z }, false)
            return
        }

        if (mode === 'annotate') {
            const atomClickCb = stateRef.current.onAtomClick
            if (atomClickCb) {
                const rect = containerRef.current.getBoundingClientRect()
                atomClickCb(atomInfo, {
                    x: (event?.clientX || 0) - rect.left,
                    y: (event?.clientY || 0) - rect.top
                })
            } else {
                const label = `${atom.resn || 'ATM'}-${atom.resi || ''} (${atom.atom || atom.elem})`
                lockPivotAndFocus({ serial: atom.serial }, label, { x: atom.x, y: atom.y, z: atom.z }, false)
            }
            return
        }

        // 2-Atom Distance Measurement Mode
        const curPending = stateRef.current.pendingMeasureAtoms || []
        if (curPending.length === 0) {
            const nextPending = [atomInfo]
            stateRef.current.pendingMeasureAtoms = nextPending
            setPendingMeasureAtoms(nextPending)
            renderAllOverlays(viewerRef.current)
            viewerRef.current?.render()
        } else {
            const firstAtom = curPending[0]
            const d = calcDistance(firstAtom, atomInfo)
            const valueText = `${d.toFixed(2)} Å`
            const midpoint = {
                x: (firstAtom.x + atomInfo.x) / 2,
                y: (firstAtom.y + atomInfo.y) / 2,
                z: (firstAtom.z + atomInfo.z) / 2
            }
            const atomSummary = `${firstAtom.resn}${firstAtom.resi}.${firstAtom.atom || firstAtom.elem} → ${atomInfo.resn}${atomInfo.resi}.${atomInfo.atom || atomInfo.elem}`
            const newMeasurement = {
                id: `${Date.now()}_${Math.random()}`,
                type: 'Distance',
                valueText,
                atomSummary,
                atoms: [firstAtom, atomInfo],
                midpoint
            }
            const nextList = [...(stateRef.current.measurements || []), newMeasurement]
            stateRef.current.pendingMeasureAtoms = []
            stateRef.current.measurements = nextList
            setPendingMeasureAtoms([])
            setMeasurements(nextList)
            renderAllOverlays(viewerRef.current)
            viewerRef.current?.render()
            emitLogMilestone('distance', `Distance: ${valueText}`, atomSummary)
        }
    }, [lockPivotAndFocus, renderAllOverlays, emitLogMilestone])

    // Surface Builder & Fast Opacity Updater
    const rebuildSurface = useCallback((show, sType = surfaceType, sScope = surfaceScope, sColor = surfaceColorMode, sOpacity = surfaceOpacity) => {
        const viewer = viewerRef.current
        const $3Dmol = $3DmolRef.current
        if (!viewer || !$3Dmol) return

        viewer.removeAllSurfaces()
        surfaceIdRef.current = null

        if (!show) {
            setSurfaceShowing(false)
            viewer.render()
            return
        }

        const typeEnum = sType === 'SAS'
            ? $3Dmol.SurfaceType.SAS
            : sType === 'SES'
                ? $3Dmol.SurfaceType.SES
                : $3Dmol.SurfaceType.VDW

        let targetSel = { hetflag: false }
        if (sScope === 'ligand') {
            targetSel = { hetflag: true }
        } else if (sScope === 'pocket' && pocketData?.pocketResidues?.length > 0) {
            targetSel = {
                or: pocketData.pocketResidues.map(r => ({ chain: r.chain, resi: r.resi }))
            }
        }

        let surfColorSpec = { colorscheme: 'whiteCarbon' }
        if (sColor === 'structure') {
            surfColorSpec = getColorSpec(currentColor, hierarchy.minB, hierarchy.maxB)
        } else if (SCIENTIFIC_SCHEMES.has(sColor)) {
            surfColorSpec = getColorSpec(sColor, hierarchy.minB, hierarchy.maxB)
        }

        const res = viewer.addSurface(
            typeEnum,
            { opacity: sOpacity, ...surfColorSpec },
            targetSel
        )
        surfaceIdRef.current = res?.surfid !== undefined ? res.surfid : res
        if (res && typeof res.then === 'function') {
            res.then((id) => {
                surfaceIdRef.current = id
                viewer.render()
            })
        }
        setSurfaceShowing(true)
        viewer.render()
        emitLogMilestone('surface', `Surface: ${sType} (${sScope})`, `Color: ${sColor} · Opacity: ${Math.round(sOpacity * 100)}%`)
    }, [surfaceType, surfaceScope, surfaceColorMode, surfaceOpacity, pocketData, currentColor, hierarchy, getColorSpec, emitLogMilestone])

    const changeSurfaceOpacity = (newOpacity) => {
        const val = Math.max(0.1, Math.min(1.0, parseFloat(newOpacity) || 0.7))
        setSurfaceOpacity(val)
        const viewer = viewerRef.current
        const $3Dmol = $3DmolRef.current
        if (!viewer || !$3Dmol || !surfaceShowing) return

        const surfId = surfaceIdRef.current
        if (surfId !== null && viewer.surfaces && viewer.surfaces[surfId]) {
            viewer.setSurfaceMaterialStyle(surfId, { opacity: val })
            viewer.render()
        } else {
            rebuildSurface(true, surfaceType, surfaceScope, surfaceColorMode, val)
        }
    }

    const loadPrimaryModelData = useCallback((pdbText, ext, resetCamera = true) => {
        const viewer = viewerRef.current
        const $3Dmol = $3DmolRef.current
        if (!viewer || !$3Dmol) return

        viewer.removeAllModels()
        overlayModelsRef.current.clear()
        setOverlayFileIds({})

        const model = viewer.addModel(pdbText, ext)
        primaryModelRef.current = model

        const atoms = model.selectedAtoms({}) || []
        const analyzed = analyzeStructureHierarchy(atoms)
        setHierarchy(analyzed)
        if (analyzed.chains.length > 0) {
            setSelectedSeqChain(analyzed.chains[0].id)
        }

        const allLigAtoms = analyzed.ligands.flatMap(l => l.atoms)
        const initialPocket = computeBindingPocketInteractions(atoms, allLigAtoms, stateRef.current.pocketCutoff)
        setPocketData(initialPocket)

        const isProtein = ['pdb', 'cif', 'mmtf', 'pqr', 'ent'].includes(ext) && analyzed.chains.length > 0
        if (!isProtein && stateRef.current.currentStyle === 'cartoon') {
            setCurrentStyle('ballstick')
            stateRef.current.currentStyle = 'ballstick'
        }

        viewer.setClickable({}, true, (atom, _viewerInstance, event) => {
            handleCanvasAtomClick(atom, event)
        })

        viewer.setHoverDuration(80)
        viewer.setHoverable(
            {},
            true,
            (atom) => {
                if (!atom || !hoverBadgeRef.current) return
                const bText = typeof atom.b === 'number' ? ` · B/pLDDT: ${atom.b.toFixed(1)}` : ''
                hoverBadgeRef.current.textContent = `${atom.resn || 'ATM'}-${atom.resi || '?'} (Chain ${atom.chain || 'A'}) · Atom ${atom.atom || atom.elem} (#${atom.serial})${bText}`
                hoverBadgeRef.current.style.display = 'flex'
            },
            () => {
                if (hoverBadgeRef.current) {
                    hoverBadgeRef.current.style.display = 'none'
                }
            }
        )

        stateRef.current.hierarchy = analyzed
        stateRef.current.pocketData = initialPocket
        applyMasterSceneStyle(viewer)

        if (resetCamera) {
            viewer.zoomTo({}, 0)
            viewer.setSlab(-1500, 1500)
        }
        viewer.render()
    }, [applyMasterSceneStyle, handleCanvasAtomClick])

    // Custom symmetric wheel/trackpad zoom listener + 1.5s "Stop & Look" Settled Camera Logger
    useEffect(() => {
        const el = containerRef.current
        if (!el) return

        const scheduleSettledCameraCheck = () => {
            if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
            settleTimerRef.current = setTimeout(() => {
                const viewer = viewerRef.current
                if (!viewer || !stateRef.current.onLogEvent) return
                try {
                    const cur = viewer.getView()
                    if (!Array.isArray(cur) || cur.length < 8) return
                    const prev = lastLoggedViewRef.current
                    if (prev) {
                        const zoomDiffRatio = Math.abs(cur[3] - prev[3]) / Math.max(1, Math.abs(prev[3]))
                        const rotDiff = Math.hypot(
                            cur[4] - prev[4],
                            cur[5] - prev[5],
                            cur[6] - prev[6],
                            cur[7] - prev[7]
                        )
                        const panDiff = Math.hypot(cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2])
                        // Only log if user moved camera by at least ~15 deg rotation, 18% zoom, or 3A pan
                        if (zoomDiffRatio < 0.18 && rotDiff < 0.12 && panDiff < 3.0) {
                            return
                        }
                    }
                    const pivotName = stateRef.current.lockedPivot?.label || 'Full Complex'
                    emitLogMilestone('camera', `Camera Viewpoint (${pivotName})`)
                } catch {
                    // ignore
                }
            }, 1500)
        }

        const onWheel = (e) => {
            e.preventDefault()
            e.stopPropagation()
            const viewer = viewerRef.current
            if (!viewer) return

            let dy = 0
            if (typeof e.deltaY === 'number' && e.deltaY !== 0) {
                dy = e.deltaMode === 1 ? e.deltaY * 25 : e.deltaY
            } else if (typeof e.wheelDelta === 'number') {
                dy = -e.wheelDelta
            }
            if (dy === 0) return

            const clamped = Math.max(-140, Math.min(140, dy))
            const factor = Math.pow(1.0032, -clamped)
            viewer.zoom(factor, 0)
            if (!stateRef.current.slabEnabled) {
                viewer.setSlab(-1500, 1500)
            }
            viewer.render()
            scheduleSettledCameraCheck()
        }

        let isDragging = false
        const onMouseDown = () => { isDragging = true }
        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false
                scheduleSettledCameraCheck()
            }
        }

        el.addEventListener('wheel', onWheel, { capture: true, passive: false })
        el.addEventListener('mousewheel', onWheel, { capture: true, passive: false })
        el.addEventListener('mousedown', onMouseDown)
        window.addEventListener('mouseup', onMouseUp)
        return () => {
            if (settleTimerRef.current) clearTimeout(settleTimerRef.current)
            el.removeEventListener('wheel', onWheel, { capture: true })
            el.removeEventListener('mousewheel', onWheel, { capture: true })
            el.removeEventListener('mousedown', onMouseDown)
            window.removeEventListener('mouseup', onMouseUp)
        }
    }, [emitLogMilestone])

    const loadPrimaryModelDataRef = useRef(loadPrimaryModelData)
    loadPrimaryModelDataRef.current = loadPrimaryModelData

    // Initial Fetch & Setup Effect — ONLY re-runs when the actual file URL or format changes
    useEffect(() => {
        let isMounted = true
        if (!containerRef.current || !url) return

        setLoading(true)
        setError(null)
        setSurfaceShowing(false)
        setLockedPivot(null)
        setSelectedResidueKey(null)
        setHiddenChains({})
        setChainStyles({})
        setHiddenLigands({})
        setPoses([])
        setActivePoseIndex(0)
        setPosePlaying(false)
        setShowAllPoses(false)
        surfaceIdRef.current = null

        containerRef.current.innerHTML = ''

        import('3dmol')
            .then((module) => {
                if (!isMounted || !containerRef.current) return Promise.reject(new Error('unmounted'))
                $3DmolRef.current = module
                const viewer = module.createViewer(containerRef.current, {
                    backgroundColor: 'white',
                    antialias: true,
                    minimumZoomToDistance: 18,
                    lowerZoomLimit: 2,
                    upperZoomLimit: 2500
                })
                viewer._handleMouseScroll = () => {}
                viewerRef.current = viewer
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

                const ext = type ? type.toLowerCase() : 'pdb'
                const parsed = parseMolecularDataAndPoses(data, ext)
                rawParsedRef.current = { ...parsed, ext }

                if (parsed.poses.length > 1) {
                    setPoses(parsed.poses)
                    setActivePoseIndex(0)
                }

                loadPrimaryModelDataRef.current(parsed.sanitizedData, ext, true)
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

    useEffect(() => {
        if (!loading && viewerRef.current) {
            renderAllOverlays(viewerRef.current)
            viewerRef.current.render()
        }
    }, [annotations, loading, renderAllOverlays])

    const handleSelectPose = useCallback((poseIdx, allCombined = false) => {
        const { poses: pList, allPosesCombinedData, ext } = rawParsedRef.current
        if (!pList || pList.length === 0) return

        setShowAllPoses(allCombined)
        if (allCombined) {
            loadPrimaryModelData(allPosesCombinedData, ext, false)
        } else {
            const bounded = Math.max(0, Math.min(pList.length - 1, poseIdx))
            setActivePoseIndex(bounded)
            loadPrimaryModelData(pList[bounded].pdbText, ext, false)
        }
    }, [loadPrimaryModelData])

    useEffect(() => {
        if (!posePlaying || poses.length <= 1) return
        const timer = setInterval(() => {
            setActivePoseIndex(prev => {
                const next = (prev + 1) % poses.length
                handleSelectPose(next, false)
                return next
            })
        }, 900)
        return () => clearInterval(timer)
    }, [posePlaying, poses.length, handleSelectPose])

    const toggleOverlayFile = async (fileObj, idx) => {
        const viewer = viewerRef.current
        if (!viewer || !fileObj) return

        const existingModel = overlayModelsRef.current.get(fileObj.id)
        if (existingModel) {
            viewer.removeModel(existingModel)
            overlayModelsRef.current.delete(fileObj.id)
            setOverlayFileIds(prev => {
                const copy = { ...prev }
                delete copy[fileObj.id]
                return copy
            })
            viewer.render()
            return
        }

        try {
            const res = await fetch(fileObj.file_url)
            if (!res.ok) throw new Error('Failed to fetch overlay structure')
            const raw = await res.text()
            const ext = (fileObj.file_extension || 'pdb').toLowerCase()
            const { sanitizedData } = parseMolecularDataAndPoses(raw, ext)
            const overlayColor = OVERLAY_PALETTE[idx % OVERLAY_PALETTE.length]

            const m = viewer.addModel(sanitizedData, ext)
            m.setStyle({}, {
                cartoon: { color: overlayColor, opacity: 0.75 },
                stick: { radius: 0.18, color: overlayColor }
            })
            overlayModelsRef.current.set(fileObj.id, m)
            setOverlayFileIds(prev => ({
                ...prev,
                [fileObj.id]: { color: overlayColor, name: fileObj.file_name }
            }))
            viewer.render()
        } catch (err) {
            console.error('Overlay error:', err)
        }
    }

    const toggleSpin = () => {
        const viewer = viewerRef.current
        if (!viewer) return
        if (isSpinning) {
            viewer.spin(false)
            setIsSpinning(false)
        } else {
            viewer.spin('y', 0.6)
            setIsSpinning(true)
        }
    }

    const nudgePan = (dx, dy) => {
        const viewer = viewerRef.current
        if (!viewer) return
        viewer.translate(dx, dy)
        viewer.render()
    }

    const stepZoom = (factor) => {
        const viewer = viewerRef.current
        if (!viewer) return
        viewer.zoom(factor, 0)
        if (!stateRef.current.slabEnabled) {
            viewer.setSlab(-1500, 1500)
        }
        viewer.render()
    }

    const updateSlab = (enabled, nearVal, farVal) => {
        const viewer = viewerRef.current
        if (!viewer) return
        setSlabEnabled(enabled)
        setSlabNear(nearVal)
        setSlabFar(farVal)
        if (enabled) {
            viewer.setSlab(nearVal, farVal)
        } else {
            viewer.setSlab(-1500, 1500)
        }
        viewer.render()
    }

    const handleTogglePocketMode = () => {
        const nextState = !pocketMode
        setPocketMode(nextState)
        if (nextState && hierarchy.ligands.length > 0) {
            const targetLig = activeLigandKey === 'ALL'
                ? hierarchy.ligands[0]
                : (hierarchy.ligands.find(l => l.key === activeLigandKey) || hierarchy.ligands[0])
            if (targetLig) {
                lockPivotAndFocus(
                    { chain: targetLig.chain, resi: targetLig.resi, resn: targetLig.resn },
                    `Pocket: ${targetLig.resn}-${targetLig.resi}`,
                    targetLig.centroid,
                    true
                )
            }
            emitLogMilestone('pocket', `Isolated Pocket View (${pocketCutoff} Å)`, `${pocketData.interactions.length} non-covalent contacts`)
        } else {
            emitLogMilestone('pocket', 'Exited Pocket Isolation View')
        }
    }

    const activeChainResidues = useMemo(() => {
        const found = hierarchy.chains.find(c => c.id === selectedSeqChain) || hierarchy.chains[0]
        return found ? found.residues : []
    }, [hierarchy.chains, selectedSeqChain])

    return (
        <div className="w-full h-full flex flex-col bg-slate-100 overflow-hidden select-none">
            {/* 1. Top Version History & Multi-Pose Bar */}
            {!error && ((versions && versions.length > 0) || (isOwner && onUploadNewVersion) || poses.length > 1) && (
                <div className="w-full bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-1.5 flex items-center justify-between gap-3 flex-shrink-0 z-20 shadow-xs overflow-x-auto">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider flex-shrink-0">
                            <History className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Versions:</span>
                        </div>

                        {versions && versions.length > 0 && (
                            <div
                                onWheel={(e) => {
                                    if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY
                                }}
                                className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5"
                            >
                                {versions.map((v, idx) => {
                                    const isSelected = activeVersionId ? v.id === activeVersionId : idx === 0
                                    const isLatest = idx === versions.length - 1 && versions.length > 1
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => onSelectVersion && onSelectVersion(v.id)}
                                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border flex-shrink-0 cursor-pointer ${
                                                isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                            }`}
                                        >
                                            <span className="font-bold">v{v.version_number || 1}</span>
                                            {isLatest && (
                                                <span className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase font-bold ${
                                                    isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-100 text-indigo-700'
                                                }`}>
                                                    Latest
                                                </span>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        )}

                        {poses.length > 1 && (
                            <div className="flex items-center gap-1.5 pl-3 border-l border-gray-200 flex-shrink-0">
                                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                                    Docking Poses ({poses.length}):
                                </span>
                                <button
                                    onClick={() => handleSelectPose((activePoseIndex - 1 + poses.length) % poses.length, false)}
                                    className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                                    title="Previous Pose"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setPosePlaying(p => !p)}
                                    className={`px-2 py-0.5 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                                        posePlaying ? 'bg-amber-500 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}
                                >
                                    {posePlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                    <span>{showAllPoses ? 'All Poses' : `Pose ${activePoseIndex + 1}/${poses.length}`}</span>
                                </button>
                                <button
                                    onClick={() => handleSelectPose((activePoseIndex + 1) % poses.length, false)}
                                    className="p-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
                                    title="Next Pose"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleSelectPose(activePoseIndex, !showAllPoses)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-semibold border cursor-pointer ${
                                        showAllPoses ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    Overlay All
                                </button>
                            </div>
                        )}
                    </div>

                    {isOwner && onUploadNewVersion && (
                        <label className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap flex-shrink-0">
                            {uploadingVersion ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            ) : (
                                <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
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
            )}

            {/* 2. Main 3D Interactive Canvas Stage */}
            <div className="flex-1 w-full h-full relative min-h-0 overflow-hidden">
                {/* SINGLE UNIFIED COLLAPSIBLE FLOATING 3D WORKSTATION WIDGET */}
                {!loading && !error && (
                    controlsCollapsed ? (
                        <button
                            onClick={() => {
                                setControlsCollapsed(false)
                            }}
                            className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-white/95 hover:bg-white backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-md border border-gray-200/90 text-xs font-semibold text-gray-700 hover:text-indigo-600 transition-all cursor-pointer animate-in fade-in zoom-in-95 duration-150"
                            title="Expand 3D Workstation Controls"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                            <span>3D Controls</span>
                            <span className="text-[10px] text-gray-400 font-mono capitalize">({currentStyle} · {clickMode})</span>
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                    ) : (
                        <div className="absolute top-3 left-3 right-3 z-20 flex justify-end pointer-events-none">
                            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-2xl shadow-md border border-gray-200/90 text-xs max-w-full animate-in fade-in slide-in-from-top-1 duration-150">
                                {/* 1. Click Action Mode Switcher (Focus Pivot | Annotate | Distance) */}
                                <div className="flex items-center bg-gray-100/90 p-0.5 rounded-xl border border-gray-200/80 gap-0.5">
                                    {[
                                        { id: 'pivot', label: 'Focus Pivot', icon: Crosshair, tip: 'Click any atom or residue to center & lock rotation/zoom pivot on it' },
                                        { id: 'annotate', label: 'Annotate', icon: MessageSquarePlus, tip: 'Click any atom to view or add spatial 3D notes' },
                                        { id: 'distance', label: 'Distance (Å)', icon: Ruler, tip: 'Click 2 atoms to measure interatomic distance (Å)' }
                                    ].map(m => {
                                        const Icon = m.icon
                                        const active = clickMode === m.id
                                        return (
                                            <button
                                                key={m.id}
                                                onClick={() => {
                                                    setClickMode(m.id)
                                                    stateRef.current.pendingMeasureAtoms = []
                                                    setPendingMeasureAtoms([])
                                                    renderAllOverlays(viewerRef.current)
                                                    viewerRef.current?.render()
                                                }}
                                                title={m.tip}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                                    active
                                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                                        : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                                                }`}
                                            >
                                                <Icon className="w-3.5 h-3.5" />
                                                <span>{m.label}</span>
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="h-5 w-px bg-gray-200 mx-0.5" />

                                {/* 2. Quick Jump & Lock Pivot Dropdown + Center Ligand */}
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                                    <Crosshair className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                    <select
                                        value=""
                                        onChange={(e) => {
                                            const val = e.target.value
                                            if (!val) return
                                            if (val === 'RESET') {
                                                resetCameraPivot()
                                            } else if (val.startsWith('LIG:')) {
                                                const ligKey = val.slice(4)
                                                const lig = hierarchy.ligands.find(l => l.key === ligKey)
                                                if (lig) {
                                                    lockPivotAndFocus(
                                                        { chain: lig.chain, resi: lig.resi, resn: lig.resn },
                                                        `Ligand ${lig.resn}-${lig.resi}`,
                                                        lig.centroid,
                                                        true
                                                    )
                                                }
                                            } else if (val.startsWith('CHAIN:')) {
                                                const chainId = val.slice(6)
                                                lockPivotAndFocus({ chain: chainId }, `Chain ${chainId}`, null, true)
                                            }
                                        }}
                                        className="bg-transparent text-gray-900 font-semibold outline-none cursor-pointer"
                                        title="Jump & Lock Rotation Pivot to Target"
                                    >
                                        <option value="">Jump to Target...</option>
                                        <option value="RESET">🌐 Full Structure (Reset Pivot)</option>
                                        {hierarchy.ligands.map(lig => (
                                            <option key={lig.key} value={`LIG:${lig.key}`}>
                                                💊 Ligand: {lig.resn}-{lig.resi} (Chain {lig.chain})
                                            </option>
                                        ))}
                                        {hierarchy.chains.map(ch => (
                                            <option key={ch.id} value={`CHAIN:${ch.id}`}>
                                                🧬 Chain {ch.id} ({ch.residueCount} residues)
                                            </option>
                                        ))}
                                    </select>

                                    {hierarchy.ligands.length > 0 && (
                                        <button
                                            onClick={() => {
                                                const firstLig = hierarchy.ligands[0]
                                                lockPivotAndFocus(
                                                    { chain: firstLig.chain, resi: firstLig.resi, resn: firstLig.resn },
                                                    `Ligand ${firstLig.resn}-${firstLig.resi}`,
                                                    firstLig.centroid,
                                                    true
                                                )
                                            }}
                                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg font-semibold transition-colors cursor-pointer whitespace-nowrap"
                                            title="Center camera and lock rotation/zoom pivot directly on the bound ligand"
                                        >
                                            🎯 Center Ligand
                                        </button>
                                    )}
                                </div>

                                <div className="h-5 w-px bg-gray-200 mx-0.5" />

                                {/* 3. Representation Selector */}
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                                    <Layers className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                    <select
                                        value={currentStyle}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setCurrentStyle(val)
                                            stateRef.current.currentStyle = val
                                            emitLogMilestone('style', `Style: ${val} · Color: ${currentColor}`)
                                        }}
                                        className="bg-transparent text-gray-900 font-semibold outline-none cursor-pointer"
                                        title="3D Representation Style"
                                    >
                                        {representations.map(r => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 4. Scientific Color Scheme Selector */}
                                <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
                                    <Palette className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                    <select
                                        value={currentColor}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            setCurrentColor(val)
                                            stateRef.current.currentColor = val
                                            emitLogMilestone('style', `Style: ${currentStyle} · Color: ${val}`)
                                        }}
                                        className="bg-transparent text-gray-900 font-semibold outline-none cursor-pointer"
                                        title="Scientific Color Scheme"
                                    >
                                        {Object.entries(colorSchemes).map(([label, value]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* 5. Pocket View, Surface, Layers, Contacts, Measurements */}
                                {hierarchy.ligands.length > 0 && (
                                    <button
                                        onClick={handleTogglePocketMode}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-semibold border transition-all cursor-pointer ${
                                            pocketMode
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-gray-50 hover:bg-emerald-50 text-gray-800 border-gray-200'
                                        }`}
                                        title="Isolate binding pocket residues around ligand, show H-bonds/contacts, and lock pivot on pocket"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Pocket View</span>
                                    </button>
                                )}

                                <button
                                    id="surface-toggle-btn"
                                    onClick={() => {
                                        if (!surfaceShowing) {
                                            rebuildSurface(true)
                                            setActiveDrawer('surface')
                                        } else if (activeDrawer === 'surface') {
                                            setActiveDrawer(null)
                                        } else {
                                            setActiveDrawer('surface')
                                        }
                                    }}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl font-semibold border transition-all cursor-pointer ${
                                        surfaceShowing
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-200'
                                    }`}
                                >
                                    <Box className="w-3.5 h-3.5" />
                                    <span>{surfaceShowing ? 'Surface: On' : 'Surface'}</span>
                                </button>

                                <button
                                    onClick={() => setActiveDrawer(d => d === 'layers' ? null : 'layers')}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold border transition-all cursor-pointer ${
                                        activeDrawer === 'layers'
                                            ? 'bg-slate-900 text-white border-slate-900'
                                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                    }`}
                                    title="Chains, Ligands, Waters & Multi-Structure Overlay"
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Layers</span>
                                </button>

                                {hierarchy.ligands.length > 0 && (
                                    <button
                                        onClick={() => setActiveDrawer(d => d === 'contacts' ? null : 'contacts')}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold border transition-all cursor-pointer ${
                                            activeDrawer === 'contacts'
                                                ? 'bg-cyan-600 text-white border-cyan-600'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                        }`}
                                        title="Inspect Non-Covalent H-Bonds, Salt Bridges, Pi-Stacking & Clashes"
                                    >
                                        <Zap className="w-3.5 h-3.5 text-cyan-500" />
                                        <span>Contacts ({pocketData.interactions.length})</span>
                                    </button>
                                )}

                                {measurements.length > 0 && (
                                    <button
                                        onClick={() => setActiveDrawer(d => d === 'measurements' ? null : 'measurements')}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl font-semibold border transition-all cursor-pointer ${
                                            activeDrawer === 'measurements'
                                                ? 'bg-amber-600 text-white border-amber-600'
                                                : 'bg-amber-50 text-amber-800 border-amber-200'
                                        }`}
                                    >
                                        <Ruler className="w-3.5 h-3.5" />
                                        <span>{measurements.length} Å</span>
                                    </button>
                                )}

                                {/* Collapse All Button */}
                                <button
                                    onClick={() => {
                                        setControlsCollapsed(true)
                                        setActiveDrawer(null)
                                    }}
                                    className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer ml-0.5"
                                    title="Collapse 3D controls into a single compact pill"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )
                )}

                {/* FLOATING CONTEXT DRAWER (Layers / Contacts / Surface / Measurements) */}
                {!loading && !error && activeDrawer && (
                    <div className="absolute top-16 right-3 z-20 w-80 max-h-[calc(100%-140px)] bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-gray-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                        {/* SURFACE STUDIO DRAWER */}
                        {activeDrawer === 'surface' && (
                            <div className="p-3.5 space-y-3 text-xs">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <span className="font-bold text-gray-900 flex items-center gap-1.5">
                                        <Box className="w-4 h-4 text-indigo-600" />
                                        Molecular Surface Studio
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => rebuildSurface(!surfaceShowing)}
                                            className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                                                surfaceShowing ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-indigo-600 text-white'
                                            }`}
                                        >
                                            {surfaceShowing ? 'Hide Surface' : 'Show Surface'}
                                        </button>
                                        <button onClick={() => setActiveDrawer(null)} className="text-gray-400 hover:text-gray-700 font-bold px-1 cursor-pointer">✕</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Surface Type</label>
                                        <select
                                            value={surfaceType}
                                            onChange={(e) => {
                                                setSurfaceType(e.target.value)
                                                if (surfaceShowing) rebuildSurface(true, e.target.value, surfaceScope, surfaceColorMode, surfaceOpacity)
                                            }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-semibold text-gray-800"
                                        >
                                            <option value="VDW">Van der Waals (VDW)</option>
                                            <option value="SAS">Solvent Accessible (SAS)</option>
                                            <option value="SES">Molecular Cavity (SES)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Region Scope</label>
                                        <select
                                            value={surfaceScope}
                                            onChange={(e) => {
                                                setSurfaceScope(e.target.value)
                                                if (surfaceShowing) rebuildSurface(true, surfaceType, e.target.value, surfaceColorMode, surfaceOpacity)
                                            }}
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-semibold text-gray-800"
                                        >
                                            <option value="full">Full Protein</option>
                                            <option value="pocket">Pocket Cavity Only</option>
                                            <option value="ligand">Ligand Only</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Surface Property Coloring</label>
                                    <select
                                        value={surfaceColorMode}
                                        onChange={(e) => {
                                            setSurfaceColorMode(e.target.value)
                                            if (surfaceShowing) rebuildSurface(true, surfaceType, surfaceScope, e.target.value, surfaceOpacity)
                                        }}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-semibold text-gray-800"
                                    >
                                        <option value="white">Translucent White</option>
                                        <option value="hydrophobicity">Hydrophobicity (Kyte-Doolittle)</option>
                                        <option value="charge">Electrostatic Potential</option>
                                        <option value="plddt">AlphaFold pLDDT Confidence</option>
                                        <option value="bfactor">B-Factor Thermal Gradient</option>
                                        <option value="structure">Match Active Structure Color</option>
                                    </select>
                                </div>

                                {surfaceShowing && (
                                    <div className="pt-1">
                                        <div className="flex justify-between text-[11px] font-semibold text-gray-700 mb-1">
                                            <span>Surface Opacity</span>
                                            <span className="font-mono text-indigo-600">{Math.round(surfaceOpacity * 100)}%</span>
                                        </div>
                                        <input
                                            id="surface-opacity-slider"
                                            type="range"
                                            min="0.1"
                                            max="1.0"
                                            step="0.05"
                                            value={surfaceOpacity}
                                            onChange={(e) => changeSurfaceOpacity(e.target.value)}
                                            onMouseUp={() => emitLogMilestone('surface', `Surface Opacity: ${Math.round(surfaceOpacity * 100)}%`)}
                                            onTouchEnd={() => emitLogMilestone('surface', `Surface Opacity: ${Math.round(surfaceOpacity * 100)}%`)}
                                            className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* LAYERS, HIERARCHY & MULTI-STRUCTURE OVERLAY DRAWER */}
                        {activeDrawer === 'layers' && (
                            <div className="p-3.5 space-y-3 text-xs overflow-y-auto">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <span className="font-bold text-gray-900 flex items-center gap-1.5">
                                        <Layers className="w-4 h-4 text-indigo-600" />
                                        Structure Hierarchy & Layers
                                    </span>
                                    <button onClick={() => setActiveDrawer(null)} className="text-gray-400 hover:text-gray-700 font-bold px-1 cursor-pointer">✕</button>
                                </div>

                                {/* Polymer Chains */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Polymer Chains ({hierarchy.chains.length})</span>
                                    {hierarchy.chains.map(ch => {
                                        const isHidden = !!hiddenChains[ch.id]
                                        return (
                                            <div key={ch.id} className="flex items-center justify-between gap-1.5 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200/80">
                                                <button
                                                    onClick={() => setHiddenChains(p => ({ ...p, [ch.id]: !p[ch.id] }))}
                                                    className={`p-1 rounded cursor-pointer ${isHidden ? 'text-gray-400' : 'text-indigo-600'}`}
                                                    title={isHidden ? 'Show Chain' : 'Hide Chain'}
                                                >
                                                    {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                                <span className={`font-semibold flex-1 truncate ${isHidden ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                                    Chain {ch.id} <span className="text-gray-400 font-normal">({ch.residueCount} aa)</span>
                                                </span>
                                                <select
                                                    value={chainStyles[ch.id] || currentStyle}
                                                    onChange={(e) => setChainStyles(p => ({ ...p, [ch.id]: e.target.value }))}
                                                    className="bg-white border border-gray-200 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-gray-700"
                                                >
                                                    {representations.map(r => (
                                                        <option key={r.value} value={r.value}>{r.label}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => lockPivotAndFocus({ chain: ch.id }, `Chain ${ch.id}`, null, true)}
                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                                    title="Center & Lock Pivot on this Chain"
                                                >
                                                    <Crosshair className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>

                                {/* Bound Ligands & Cofactors */}
                                {hierarchy.ligands.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase">Ligands & Heteroatoms ({hierarchy.ligands.length})</span>
                                        {hierarchy.ligands.map(lig => {
                                            const isHidden = !!hiddenLigands[lig.key]
                                            return (
                                                <div key={lig.key} className="flex items-center justify-between gap-2 bg-emerald-50/50 px-2.5 py-1.5 rounded-xl border border-emerald-200/70">
                                                    <button
                                                        onClick={() => setHiddenLigands(p => ({ ...p, [lig.key]: !p[lig.key] }))}
                                                        className={`p-1 rounded cursor-pointer ${isHidden ? 'text-gray-400' : 'text-emerald-600'}`}
                                                    >
                                                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <span className="font-semibold text-gray-800 flex-1 truncate">
                                                        {lig.resn}-{lig.resi} <span className="text-gray-400 font-normal">({lig.atomCount} atoms)</span>
                                                    </span>
                                                    <button
                                                        onClick={() => lockPivotAndFocus(
                                                            { chain: lig.chain, resi: lig.resi, resn: lig.resn },
                                                            `Ligand ${lig.resn}-${lig.resi}`,
                                                            lig.centroid,
                                                            true
                                                        )}
                                                        className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                                                        title="Lock rotation & zoom center on this ligand"
                                                    >
                                                        <Crosshair className="w-3 h-3" />
                                                        Focus
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Waters & Ions Toggles */}
                                <div className="flex items-center gap-2 pt-1">
                                    <button
                                        onClick={() => setShowWaters(w => !w)}
                                        className={`flex-1 py-1.5 px-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                                            showWaters ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {showWaters ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                        <span>Waters ({hierarchy.waterCount})</span>
                                    </button>
                                    <button
                                        onClick={() => setShowIons(i => !i)}
                                        className={`flex-1 py-1.5 px-2 rounded-xl border font-semibold flex items-center justify-center gap-1.5 cursor-pointer ${
                                            showIons ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                                        }`}
                                    >
                                        {showIons ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                        <span>Ions ({hierarchy.ionCount})</span>
                                    </button>
                                </div>

                                {/* Multi-Structure Superposition / Overlay */}
                                {allProjectFiles.length > 1 && (
                                    <div className="space-y-1.5 pt-2 border-t border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
                                            <CopyPlus className="w-3 h-3 text-indigo-500" />
                                            Compare / Superpose Project Structures
                                        </span>
                                        {allProjectFiles
                                            .filter(f => f.file_url !== url)
                                            .map((f, idx) => {
                                                const activeOverlay = overlayFileIds[f.id]
                                                return (
                                                    <div key={f.id} className="flex items-center justify-between gap-2 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-200">
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            {activeOverlay && (
                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                                    style={{ backgroundColor: activeOverlay.color }}
                                                                />
                                                            )}
                                                            <span className="truncate font-medium text-gray-700">
                                                                {f.file_name} (v{f.version_number || 1})
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => toggleOverlayFile(f, idx)}
                                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                                                                activeOverlay
                                                                    ? 'bg-red-50 text-red-600 border border-red-200'
                                                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                                            }`}
                                                        >
                                                            {activeOverlay ? 'Remove' : 'Overlay'}
                                                        </button>
                                                    </div>
                                                )
                                            })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* NON-COVALENT INTERACTIONS & BINDING POCKET DRAWER */}
                        {activeDrawer === 'contacts' && (
                            <div className="p-3.5 space-y-3 text-xs overflow-y-auto">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <span className="font-bold text-gray-900 flex items-center gap-1.5">
                                        <Zap className="w-4 h-4 text-cyan-600" />
                                        Binding Pocket & Contacts
                                    </span>
                                    <button onClick={() => setActiveDrawer(null)} className="text-gray-400 hover:text-gray-700 font-bold px-1 cursor-pointer">✕</button>
                                </div>

                                <div className="space-y-2 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-gray-700">Pocket Distance Cutoff</span>
                                        <span className="font-mono font-bold text-indigo-600">{pocketCutoff.toFixed(1)} Å</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="3.0"
                                        max="7.0"
                                        step="0.5"
                                        value={pocketCutoff}
                                        onChange={(e) => setPocketCutoff(parseFloat(e.target.value))}
                                        onMouseUp={() => emitLogMilestone('pocket', `Pocket Cutoff: ${pocketCutoff.toFixed(1)} Å`, `${pocketData.interactions.length} contacts`)}
                                        onTouchEnd={() => emitLogMilestone('pocket', `Pocket Cutoff: ${pocketCutoff.toFixed(1)} Å`, `${pocketData.interactions.length} contacts`)}
                                        className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <div className="flex items-center justify-between pt-1">
                                        <label className="flex items-center gap-1.5 font-semibold text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={showInteractionLines}
                                                onChange={(e) => setShowInteractionLines(e.target.checked)}
                                                className="rounded accent-indigo-600"
                                            />
                                            <span>3D Dashed Bond Lines</span>
                                        </label>
                                        <button
                                            onClick={handleTogglePocketMode}
                                            className={`px-2 py-0.5 rounded-md font-bold cursor-pointer ${
                                                pocketMode ? 'bg-emerald-600 text-white' : 'bg-indigo-50 text-indigo-700'
                                            }`}
                                        >
                                            {pocketMode ? 'Pocket Isolated' : 'Isolate Pocket'}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                                        Detected Contacts ({pocketData.interactions.length}) — Click to Focus Pivot
                                    </span>
                                    {pocketData.interactions.length === 0 ? (
                                        <p className="text-gray-400 py-4 text-center">No non-covalent contacts within {pocketCutoff} Å.</p>
                                    ) : (
                                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                                            {pocketData.interactions.map(inter => (
                                                <button
                                                    key={inter.id}
                                                    onClick={() => {
                                                        lockPivotAndFocus(
                                                            { chain: inter.proteinAtom.chain, resi: inter.proteinAtom.resi },
                                                            `${inter.residueLabel} (${inter.type})`,
                                                            {
                                                                x: (inter.proteinAtom.x + inter.ligandAtom.x) / 2,
                                                                y: (inter.proteinAtom.y + inter.ligandAtom.y) / 2,
                                                                z: (inter.proteinAtom.z + inter.ligandAtom.z) / 2
                                                            },
                                                            false
                                                        )
                                                    }}
                                                    className="w-full text-left flex items-center justify-between gap-2 p-2 rounded-xl bg-gray-50 hover:bg-indigo-50/70 border border-gray-200/80 transition-colors cursor-pointer"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: inter.color }}
                                                            />
                                                            <span className="font-bold text-gray-800">{inter.residueLabel}</span>
                                                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-white border border-gray-200 font-semibold text-gray-600">
                                                                {inter.type}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 font-mono mt-0.5 pl-3.5">
                                                            {inter.atomPairLabel}
                                                        </div>
                                                    </div>
                                                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                                        {inter.distance} Å
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* INTERATOMIC DISTANCE MEASUREMENTS DRAWER */}
                        {activeDrawer === 'measurements' && (
                            <div className="p-3.5 space-y-2.5 text-xs overflow-y-auto">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                                    <span className="font-bold text-gray-900 flex items-center gap-1.5">
                                        <Ruler className="w-4 h-4 text-amber-600" />
                                        Distance Measurements ({measurements.length})
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => {
                                                stateRef.current.measurements = []
                                                stateRef.current.pendingMeasureAtoms = []
                                                setMeasurements([])
                                                setPendingMeasureAtoms([])
                                                renderAllOverlays(viewerRef.current)
                                                viewerRef.current?.render()
                                            }}
                                            className="px-2 py-0.5 bg-red-50 text-red-600 rounded-md font-semibold cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                        <button onClick={() => setActiveDrawer(null)} className="text-gray-400 hover:text-gray-700 font-bold px-1 cursor-pointer">✕</button>
                                    </div>
                                </div>
                                {measurements.map(m => (
                                    <div key={m.id} className="flex items-center justify-between gap-2 bg-amber-50/50 border border-amber-200/80 rounded-xl p-2">
                                        <div
                                            onClick={() => lockPivotAndFocus({ serial: m.atoms[0]?.serial }, m.type, m.midpoint, false)}
                                            className="flex-1 cursor-pointer"
                                        >
                                            <div className="font-bold text-amber-900">{m.type}: {m.valueText}</div>
                                            <div className="text-[10px] font-mono text-gray-500 truncate">{m.atomSummary}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const nextList = measurements.filter(x => x.id !== m.id)
                                                stateRef.current.measurements = nextList
                                                setMeasurements(nextList)
                                                renderAllOverlays(viewerRef.current)
                                                viewerRef.current?.render()
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-600 cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* BOTTOM-RIGHT: Collapsible Camera Pan D-Pad, Zoom, Auto-Spin, Depth Clipping (Slab) & 1D Sequence Toggle */}
                {!loading && !error && (
                    <div className="absolute bottom-3 right-3 z-20 flex flex-col items-end gap-2">
                        {slabEnabled && !cameraCollapsed && (
                            <div className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl shadow-lg border border-gray-200 text-xs space-y-1.5 w-56">
                                <div className="flex items-center justify-between font-bold text-gray-700">
                                    <span>Z-Slab Clipping Depth</span>
                                    <span className="font-mono text-[10px] text-indigo-600">{slabNear} to {slabFar} Å</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 w-8">Front</span>
                                    <input
                                        type="range"
                                        min="-100"
                                        max="0"
                                        step="2"
                                        value={slabNear}
                                        onChange={(e) => updateSlab(true, Number(e.target.value), slabFar)}
                                        className="flex-1 h-1.5 bg-indigo-200 rounded-lg accent-indigo-600 cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-gray-500 w-8">Back</span>
                                    <input
                                        type="range"
                                        min="5"
                                        max="100"
                                        step="2"
                                        value={slabFar}
                                        onChange={(e) => updateSlab(true, slabNear, Number(e.target.value))}
                                        className="flex-1 h-1.5 bg-indigo-200 rounded-lg accent-indigo-600 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        {cameraCollapsed ? (
                            <button
                                onClick={() => setCameraCollapsed(false)}
                                className="flex items-center gap-1.5 bg-white/95 hover:bg-white backdrop-blur-md px-3 py-1.5 rounded-2xl shadow-md border border-gray-200/90 text-xs font-semibold text-gray-700 hover:text-indigo-600 transition-all cursor-pointer"
                                title="Expand Camera & Navigation Controls"
                            >
                                <Move className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Camera</span>
                                <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md p-1.5 rounded-2xl shadow-md border border-gray-200/90">
                                {/* 2D Pan Nudge Buttons */}
                                <div className="flex items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-xl px-1 py-0.5" title="Pan / Translate Molecule on Screen">
                                    <Move className="w-3 h-3 text-gray-400 mx-1" />
                                    <button onClick={() => nudgePan(-25, 0)} className="p-1 hover:bg-white rounded text-gray-700 cursor-pointer" title="Pan Left">
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="flex flex-col">
                                        <button onClick={() => nudgePan(0, 25)} className="p-0.5 hover:bg-white rounded text-gray-700 cursor-pointer" title="Pan Up">
                                            <ChevronUp className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => nudgePan(0, -25)} className="p-0.5 hover:bg-white rounded text-gray-700 cursor-pointer" title="Pan Down">
                                            <ChevronDown className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <button onClick={() => nudgePan(25, 0)} className="p-1 hover:bg-white rounded text-gray-700 cursor-pointer" title="Pan Right">
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Zoom In / Out */}
                                <button
                                    onClick={() => stepZoom(1.25)}
                                    className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 cursor-pointer"
                                    title="Zoom In"
                                >
                                    <ZoomIn className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => stepZoom(0.8)}
                                    className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 cursor-pointer"
                                    title="Zoom Out"
                                >
                                    <ZoomOut className="w-3.5 h-3.5" />
                                </button>

                                {/* Slice / Slab Clipping Plane Toggle */}
                                <button
                                    onClick={() => updateSlab(!slabEnabled, slabNear, slabFar)}
                                    className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                                        slabEnabled
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                    }`}
                                    title="Slice / Depth Clipping Plane (Inspect buried active sites)"
                                >
                                    <Scissors className="w-3.5 h-3.5" />
                                </button>

                                {/* Auto-Spin Turntable Toggle */}
                                <button
                                    onClick={toggleSpin}
                                    className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer ${
                                        isSpinning
                                            ? 'bg-indigo-600 text-white border-indigo-600'
                                            : 'bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-700'
                                    }`}
                                    title="Toggle 360° Turntable Spin"
                                >
                                    <RotateCcw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin' : ''}`} />
                                    <span>Spin</span>
                                </button>

                                {/* Reset Center & Pivot to Full Complex */}
                                <button
                                    onClick={resetCameraPivot}
                                    className="px-2.5 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold cursor-pointer"
                                    title="Reset rotation pivot and zoom to full complex"
                                >
                                    Reset View
                                </button>

                                {/* Toggle Bottom 1D Sequence Strip (Hidden by default) */}
                                {hierarchy.chains.length > 0 && (
                                    <button
                                        onClick={() => setShowSequenceBar(s => !s)}
                                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 cursor-pointer ${
                                            showSequenceBar
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                                        }`}
                                        title="Toggle 1D Amino Acid Sequence Bar"
                                    >
                                        <Dna className="w-3.5 h-3.5" />
                                        <span>1D Seq</span>
                                    </button>
                                )}

                                {/* Collapse Camera Dock */}
                                <button
                                    onClick={() => setCameraCollapsed(true)}
                                    className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
                                    title="Collapse Camera Controls"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* BOTTOM-LEFT: Active Pivot Lock Badge + Zero-Lag DOM Hover Atom Inspector */}
                {!loading && !error && (
                    <div className="absolute bottom-3 left-3 z-20 flex flex-col items-start gap-1.5 pointer-events-none">
                        <div
                            ref={hoverBadgeRef}
                            style={{ display: 'none' }}
                            className="px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-mono shadow-lg items-center gap-2"
                        />

                        {lockedPivot ? (
                            <div className="pointer-events-auto px-3 py-1 rounded-full bg-emerald-600/95 text-white text-xs font-semibold shadow-md flex items-center gap-2">
                                <Crosshair className="w-3.5 h-3.5 animate-pulse" />
                                <span>Rotation & Zoom Pivot Locked: <strong>{lockedPivot.label}</strong></span>
                                <button
                                    onClick={resetCameraPivot}
                                    className="ml-1 px-1.5 py-0.2 bg-white/20 hover:bg-white/30 rounded-full text-[10px] cursor-pointer"
                                >
                                    Unlock / Reset
                                </button>
                            </div>
                        ) : (
                            <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 text-xs text-gray-600 shadow-xs flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                {clickMode === 'pivot' && 'Click any atom, pocket residue, or ligand to lock rotation & zoom center onto it'}
                                {clickMode === 'annotate' && 'Click any atom to add a 3D annotation or lock camera pivot'}
                                {clickMode === 'distance' && `Click ${2 - pendingMeasureAtoms.length} atom(s) to measure interatomic distance (Å)`}
                            </div>
                        )}
                    </div>
                )}

                {/* Loading & Error Overlays */}
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 z-10">
                        <div className="flex flex-col items-center gap-2">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
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

                {/* WebGL 3Dmol Container */}
                <div
                    ref={containerRef}
                    className="w-full h-full"
                    style={{ cursor: 'crosshair' }}
                />
            </div>

            {/* 3. Docked Bottom 1D Interactive Sequence Bar (Hidden by default; pops up when '1D Seq' is clicked) */}
            {!loading && !error && showSequenceBar && hierarchy.chains.length > 0 && (
                <div className="w-full bg-white border-t border-gray-200 px-3 py-2 flex items-center gap-2.5 flex-shrink-0 z-20 shadow-inner">
                    <div className="flex items-center gap-1 flex-shrink-0 border-r border-gray-200 pr-2.5">
                        <Dna className="w-4 h-4 text-indigo-600 mr-1" />
                        {hierarchy.chains.map(ch => (
                            <button
                                key={ch.id}
                                onClick={() => setSelectedSeqChain(ch.id)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                    selectedSeqChain === ch.id
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                Chain {ch.id}
                            </button>
                        ))}
                    </div>

                    <div
                        onWheel={(e) => {
                            if (e.deltaY !== 0) e.currentTarget.scrollLeft += e.deltaY
                        }}
                        className="flex items-center gap-1 overflow-x-auto custom-scrollbar flex-1 py-0.5"
                    >
                        {activeChainResidues.map(res => {
                            const resKey = `${res.chain}:${res.resi}`
                            const isSelected = selectedResidueKey === resKey
                            const isInPocket = pocketMode && pocketData.pocketResidues.some(
                                p => p.chain === res.chain && p.resi === res.resi
                            )
                            return (
                                <button
                                    key={resKey}
                                    onClick={() => {
                                        setSelectedResidueKey(resKey)
                                        lockPivotAndFocus(
                                            { chain: res.chain, resi: res.resi },
                                            `${res.resn}-${res.resi} (Chain ${res.chain})`,
                                            { x: res.x, y: res.y, z: res.z },
                                            true
                                        )
                                    }}
                                    title={`${res.resn}-${res.resi} (Chain ${res.chain}) — Click to center & zoom to residue`}
                                    className={`flex flex-col items-center justify-center min-w-[26px] py-0.5 px-1 rounded-md border text-[10px] font-mono transition-all flex-shrink-0 cursor-pointer ${
                                        isSelected
                                            ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-200 scale-105'
                                            : isInPocket
                                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                                                : 'bg-gray-50 hover:bg-indigo-50 text-gray-800 border-gray-200'
                                    }`}
                                >
                                    <span className="font-bold leading-tight">{res.code}</span>
                                    <span className={`text-[8px] leading-none ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>
                                        {res.resi}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}
