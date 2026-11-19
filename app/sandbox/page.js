'use client'
import { useState } from 'react'
import MoleculeViewer from '@/components/MoleculeViewer'
import AtomAnnotationPopup from '@/components/AtomAnnotationPopup'
import Link from 'next/link'
import { ArrowLeft, Upload, Box, FlaskConical, Sparkles } from 'lucide-react'

const SAMPLE_STRUCTURES = [
    {
        id: 'vina-complex',
        name: 'AutoDock Vina Docked Complex (Receptor + UNL Ligand)',
        file_name: 'webvina_complex.pdb',
        file_url: '/sample_vina_complex.pdb',
        file_extension: 'pdb',
        version_number: 1
    },
    {
        id: '4hhb',
        name: '4HHB — Human Hemoglobin Tetramer (4 Chains + 4 Heme Ligands)',
        file_name: '4HHB.pdb',
        file_url: 'https://files.rcsb.org/download/4HHB.pdb',
        file_extension: 'pdb',
        version_number: 1
    },
    {
        id: '1crn',
        name: '1CRN — Crambin High-Resolution Crystal Structure',
        file_name: '1CRN.pdb',
        file_url: 'https://files.rcsb.org/download/1CRN.pdb',
        file_extension: 'pdb',
        version_number: 1
    }
]

export default function SandboxPage() {
    const [structures, setStructures] = useState(SAMPLE_STRUCTURES)
    const [activeIdx, setActiveIdx] = useState(0)
    const [clickedAtom, setClickedAtom] = useState(null)
    const [popupPos, setPopupPos] = useState({ x: 0, y: 0 })
    const [localAnnotations, setLocalAnnotations] = useState([
        {
            id: 'demo-ann-1',
            atom_serial: 150,
            atom_name: 'CA',
            residue_name: 'ACTIVE',
            residue_id: 1,
            chain: 'A',
            content: 'Sample Spatial 3D Annotation'
        }
    ])
    const [externalFocusAtom, setExternalFocusAtom] = useState(null)

    const activeStructure = structures[activeIdx] || structures[0]

    const handleLocalFileUpload = (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const ext = file.name.split('.').pop().toLowerCase()
        const blobUrl = URL.createObjectURL(file)
        const newEntry = {
            id: `local-${Date.now()}`,
            name: `${file.name} (Local File)`,
            file_name: file.name,
            file_url: blobUrl,
            file_extension: ext,
            version_number: 1
        }
        setStructures(prev => [newEntry, ...prev])
        setActiveIdx(0)
    }

    return (
        <div className="flex flex-col h-[calc(100vh-64px)] bg-white overflow-hidden">
            {/* Top Bar */}
            <div className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between gap-3 flex-shrink-0 z-30 shadow-2xs">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Home</span>
                    </Link>

                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            3D Workstation Live Sandbox
                        </span>
                    </div>
                </div>

                {/* Preset & Local Structure Switcher */}
                <div className="flex items-center gap-2 flex-1 max-w-2xl">
                    <FlaskConical className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <select
                        value={activeIdx}
                        onChange={(e) => setActiveIdx(Number(e.target.value))}
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-indigo-500 cursor-pointer"
                    >
                        {structures.map((s, idx) => (
                            <option key={s.id} value={idx}>
                                {s.name}
                            </option>
                        ))}
                    </select>

                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs transition-colors flex-shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Open Local File (.PDB / .SDF / .MOL2 / .CIF)</span>
                        <input
                            type="file"
                            accept=".pdb,.pdbqt,.sdf,.mol2,.xyz,.cif,.cube,.pqr"
                            className="hidden"
                            onChange={handleLocalFileUpload}
                        />
                    </label>
                </div>
            </div>

            {/* 3D Workstation Main Area */}
            <div className="flex-1 w-full h-full relative min-h-0">
                <MoleculeViewer
                    url={activeStructure.file_url}
                    type={activeStructure.file_extension}
                    annotations={localAnnotations}
                    onAtomClick={(atomData, pos) => {
                        setClickedAtom(atomData)
                        setPopupPos(pos)
                    }}
                    versions={structures}
                    activeVersionId={activeStructure.id}
                    onSelectVersion={(selId) => {
                        const idx = structures.findIndex(s => s.id === selId)
                        if (idx !== -1) setActiveIdx(idx)
                    }}
                    isOwner={true}
                    allProjectFiles={structures}
                    externalFocusAtom={externalFocusAtom}
                />

                {clickedAtom && (
                    <AtomAnnotationPopup
                        atomData={clickedAtom}
                        position={popupPos}
                        projectId="sandbox"
                        fileId={activeStructure.id}
                        user={{ id: 'local-user', email: 'researcher@molshare.com' }}
                        isOwner={true}
                        onClose={() => setClickedAtom(null)}
                        onAnnotationSaved={() => {}}
                        onFocusAtom={(atom) => {
                            setExternalFocusAtom({ ...atom, _ts: Date.now() })
                            setClickedAtom(null)
                        }}
                    />
                )}
            </div>
        </div>
    )
}
