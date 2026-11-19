// Scientific & Structural Biology Analysis Engine for MolShare 3D Workstation

export const AMINO_ACID_1LETTER = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C',
    GLN: 'Q', GLU: 'E', GLY: 'G', HIS: 'H', ILE: 'I',
    LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P',
    SER: 'S', THR: 'T', TRP: 'W', TYR: 'Y', VAL: 'V',
    MSE: 'M', SEC: 'U', PYL: 'O',
    DA: 'A', DT: 'T', DC: 'C', DG: 'G', A: 'A', U: 'U', C: 'C', G: 'G'
}

export const STANDARD_RESIDUES = new Set(Object.keys(AMINO_ACID_1LETTER))

export const WATER_RESIDUES = new Set(['HOH', 'WAT', 'TIP', 'TIP3', 'SOL', 'DOD'])

export const ION_RESIDUES = new Set([
    'NA', 'CL', 'MG', 'ZN', 'CA', 'FE', 'MN', 'CU', 'K', 'CO', 'NI', 'CD', 'IOD', 'BR'
])

// Kyte-Doolittle Hydrophobicity Scale (-4.5 hydrophilic to +4.5 hydrophobic)
export const HYDROPHOBICITY_SCALE = {
    ILE: 4.5, VAL: 4.2, LEU: 3.8, PHE: 2.8, CYS: 2.5,
    MET: 1.9, ALA: 1.8, GLY: -0.4, THR: -0.7, SER: -0.8,
    TRP: -0.9, TYR: -1.3, PRO: -1.6, HIS: -3.2, GLU: -3.5,
    GLN: -3.5, ASP: -3.5, ASN: -3.5, LYS: -3.9, ARG: -4.5
}

// Residue Electrostatic Charge Class
export const RESIDUE_CHARGE = {
    ARG: 1, LYS: 1, HIS: 0.5,
    ASP: -1, GLU: -1
}

export const AROMATIC_RESIDUES = new Set(['PHE', 'TYR', 'TRP', 'HIS'])

/**
 * Euclidean distance between two 3D points (in Angstroms)
 */
export function calcDistance(a, b) {
    if (!a || !b) return 0
    const dx = (a.x || 0) - (b.x || 0)
    const dy = (a.y || 0) - (b.y || 0)
    const dz = (a.z || 0) - (b.z || 0)
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/**
 * 3-Atom Bond Angle A-B-C in degrees (with B as vertex)
 */
export function calcAngle(a, b, c) {
    if (!a || !b || !c) return 0
    const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
    const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z)
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z)
    if (mag1 === 0 || mag2 === 0) return 0
    const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)))
    return (Math.acos(cosTheta) * 180) / Math.PI
}

/**
 * 4-Atom Dihedral / Torsion Angle A-B-C-D in degrees (-180 to +180)
 */
export function calcDihedral(a, b, c, d) {
    if (!a || !b || !c || !d) return 0
    const b1 = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }
    const b2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z }
    const b3 = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z }

    const cross = (u, v) => ({
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x
    })
    const dot = (u, v) => u.x * v.x + u.y * v.y + u.z * v.z
    const norm = (u) => {
        const m = Math.sqrt(dot(u, u))
        return m === 0 ? { x: 0, y: 0, z: 0 } : { x: u.x / m, y: u.y / m, z: u.z / m }
    }

    const n1 = norm(cross(b1, b2))
    const n2 = norm(cross(b2, b3))
    const b2Norm = norm(b2)
    const m1 = cross(n1, b2Norm)

    const x = dot(n1, n2)
    const y = dot(m1, n2)
    return -Math.atan2(y, x) * (180 / Math.PI)
}

/**
 * Compute geometric centroid {x, y, z} of an array of atoms
 */
export function calcCentroid(atoms) {
    if (!atoms || atoms.length === 0) return { x: 0, y: 0, z: 0 }
    let sx = 0, sy = 0, sz = 0
    for (const a of atoms) {
        sx += a.x || 0
        sy += a.y || 0
        sz += a.z || 0
    }
    return {
        x: sx / atoms.length,
        y: sy / atoms.length,
        z: sz / atoms.length
    }
}

/**
 * Color mapper for Scientific Color Schemes
 */
export function getScientificAtomColor(atom, scheme, minB = 0, maxB = 100) {
    if (!atom) return '#94a3b8'
    const resn = (atom.resn || '').toUpperCase().trim()

    if (scheme === 'plddt') {
        const score = typeof atom.b === 'number' ? atom.b : 75
        if (score >= 90) return '#0053D6' // Very high (Dark Blue)
        if (score >= 70) return '#65CBF3' // Confident (Light Blue)
        if (score >= 50) return '#FFDB13' // Low (Yellow)
        return '#FF7D45'                  // Very low (Orange)
    }

    if (scheme === 'bfactor') {
        const b = typeof atom.b === 'number' ? atom.b : 30
        const span = Math.max(1, maxB - minB)
        const t = Math.max(0, Math.min(1, (b - minB) / span))
        // Blue (low B) -> White (mid) -> Red (high B)
        if (t < 0.5) {
            const k = t * 2
            const r = Math.round(59 + k * (248 - 59))
            const g = Math.round(130 + k * (250 - 130))
            const bl = Math.round(246 + k * (252 - 246))
            return `rgb(${r},${g},${bl})`
        } else {
            const k = (t - 0.5) * 2
            const r = Math.round(248 - k * (248 - 239))
            const g = Math.round(250 - k * (250 - 68))
            const bl = Math.round(252 - k * (252 - 68))
            return `rgb(${r},${g},${bl})`
        }
    }

    if (scheme === 'hydrophobicity') {
        const h = HYDROPHOBICITY_SCALE[resn]
        if (h === undefined) return '#cbd5e1'
        // Normalize -4.5 .. +4.5 to 0 .. 1
        const t = (h + 4.5) / 9.0
        if (t < 0.5) {
            // Hydrophilic: Deep Blue (#0284c7) to White (#f8fafc)
            const k = t * 2
            const r = Math.round(2 + k * 246)
            const g = Math.round(132 + k * 118)
            const bl = Math.round(199 + k * 53)
            return `rgb(${r},${g},${bl})`
        } else {
            // Hydrophobic: White (#f8fafc) to Rich Amber/Orange (#ea580c)
            const k = (t - 0.5) * 2
            const r = Math.round(248 - k * (248 - 234))
            const g = Math.round(250 - k * (250 - 88))
            const bl = Math.round(252 - k * (252 - 12))
            return `rgb(${r},${g},${bl})`
        }
    }

    if (scheme === 'charge') {
        const q = RESIDUE_CHARGE[resn]
        if (q > 0) return '#2563eb'  // Positive (Blue)
        if (q < 0) return '#dc2626'  // Negative (Red)
        if (['SER', 'THR', 'ASN', 'GLN', 'TYR', 'CYS'].includes(resn)) return '#06b6d4' // Polar (Cyan)
        return '#e2e8f0'             // Nonpolar (Light Slate)
    }

    return '#94a3b8'
}

/**
 * Extract 1D Sequence, Chains, Ligands, Waters, Ions, and B-factor range from 3Dmol atoms list
 */
export function analyzeStructureHierarchy(atoms = []) {
    const chainsMap = new Map()
    const ligandsMap = new Map()
    let waterCount = 0
    let ionCount = 0
    let minB = Infinity
    let maxB = -Infinity

    for (const atom of atoms) {
        if (!atom) continue
        const resn = (atom.resn || 'UNK').toUpperCase().trim()
        const chain = (atom.chain || 'A').trim() || 'A'
        const resi = atom.resi

        if (typeof atom.b === 'number' && !Number.isNaN(atom.b)) {
            if (atom.b < minB) minB = atom.b
            if (atom.b > maxB) maxB = atom.b
        }

        if (WATER_RESIDUES.has(resn)) {
            waterCount++
            continue
        }

        if (ION_RESIDUES.has(resn)) {
            ionCount++
            continue
        }

        if (STANDARD_RESIDUES.has(resn) && !atom.hetflag) {
            if (!chainsMap.has(chain)) {
                chainsMap.set(chain, new Map())
            }
            const resMap = chainsMap.get(chain)
            if (!resMap.has(resi)) {
                resMap.set(resi, {
                    resi,
                    resn,
                    code: AMINO_ACID_1LETTER[resn] || 'X',
                    chain,
                    ss: atom.ss || 'c',
                    b: atom.b || 0,
                    x: atom.x,
                    y: atom.y,
                    z: atom.z,
                    atomCount: 1
                })
            } else {
                const entry = resMap.get(resi)
                entry.atomCount++
                if (atom.atom === 'CA') {
                    entry.x = atom.x
                    entry.y = atom.y
                    entry.z = atom.z
                    entry.b = atom.b || entry.b
                    entry.ss = atom.ss || entry.ss
                }
            }
        } else {
            // Ligand or cofactor
            const ligKey = `${resn}:${chain}:${resi}`
            if (!ligandsMap.has(ligKey)) {
                ligandsMap.set(ligKey, {
                    key: ligKey,
                    resn,
                    chain,
                    resi,
                    label: `${resn}-${resi} (Chain ${chain})`,
                    atoms: []
                })
            }
            ligandsMap.get(ligKey).atoms.push(atom)
        }
    }

    const chains = Array.from(chainsMap.entries()).map(([chainId, resMap]) => {
        const residues = Array.from(resMap.values()).sort((a, b) => (a.resi || 0) - (b.resi || 0))
        return {
            id: chainId,
            residueCount: residues.length,
            residues
        }
    })

    const ligands = Array.from(ligandsMap.values()).map(lig => ({
        ...lig,
        atomCount: lig.atoms.length,
        centroid: calcCentroid(lig.atoms)
    }))

    return {
        chains,
        ligands,
        waterCount,
        ionCount,
        minB: minB === Infinity ? 0 : minB,
        maxB: maxB === -Infinity ? 100 : maxB
    }
}

/**
 * Compute Non-Covalent Protein-Ligand Interactions & Binding Pocket Residues
 */
export function computeBindingPocketInteractions(allAtoms = [], ligandAtoms = [], cutoff = 4.5) {
    if (!allAtoms.length || !ligandAtoms.length) {
        return { pocketResidues: [], interactions: [] }
    }

    const ligandSerials = new Set(ligandAtoms.map(a => a.serial))
    const pocketResMap = new Map()
    const interactions = []

    const isPolar = (elem) => ['N', 'O', 'F', 'S'].includes((elem || '').toUpperCase())
    const isCarbon = (elem) => (elem || '').toUpperCase() === 'C'
    const isPositiveAtom = (atom) => {
        const resn = (atom.resn || '').toUpperCase()
        const name = (atom.atom || '').toUpperCase()
        return (resn === 'ARG' && ['NH1', 'NH2', 'NE'].includes(name)) ||
            (resn === 'LYS' && name === 'NZ') ||
            (resn === 'HIS' && ['ND1', 'NE2'].includes(name))
    }
    const isNegativeAtom = (atom) => {
        const resn = (atom.resn || '').toUpperCase()
        const name = (atom.atom || '').toUpperCase()
        return (resn === 'ASP' && ['OD1', 'OD2'].includes(name)) ||
            (resn === 'GLU' && ['OE1', 'OE2'].includes(name))
    }

    // Pre-calculate ligand bounding box (+ cutoff margin) to skip 95% of distant protein atoms in O(1)
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (const lAtom of ligandAtoms) {
        if (!lAtom) continue
        if (lAtom.x < minX) minX = lAtom.x
        if (lAtom.y < minY) minY = lAtom.y
        if (lAtom.z < minZ) minZ = lAtom.z
        if (lAtom.x > maxX) maxX = lAtom.x
        if (lAtom.y > maxY) maxY = lAtom.y
        if (lAtom.z > maxZ) maxZ = lAtom.z
    }
    minX -= cutoff; minY -= cutoff; minZ -= cutoff
    maxX += cutoff; maxY += cutoff; maxZ += cutoff

    // Track best interaction per (residue, type) so we don't clutter with duplicates
    const bestPairMap = new Map()

    for (const pAtom of allAtoms) {
        if (!pAtom || ligandSerials.has(pAtom.serial)) continue
        // Fast bounding-box rejection before inner loop
        if (pAtom.x < minX || pAtom.x > maxX || pAtom.y < minY || pAtom.y > maxY || pAtom.z < minZ || pAtom.z > maxZ) {
            continue
        }
        const resn = (pAtom.resn || '').toUpperCase().trim()
        if (WATER_RESIDUES.has(resn)) continue
        if ((pAtom.elem || '').toUpperCase() === 'H') continue

        for (const lAtom of ligandAtoms) {
            if (!lAtom || (lAtom.elem || '').toUpperCase() === 'H') continue
            const dist = calcDistance(pAtom, lAtom)
            if (dist > cutoff) continue

            const resKey = `${pAtom.chain || 'A'}:${pAtom.resi}:${resn}`
            if (!pocketResMap.has(resKey)) {
                pocketResMap.set(resKey, {
                    key: resKey,
                    chain: pAtom.chain || 'A',
                    resi: pAtom.resi,
                    resn,
                    minDist: dist,
                    repAtom: pAtom
                })
            } else if (dist < pocketResMap.get(resKey).minDist) {
                pocketResMap.get(resKey).minDist = dist
                pocketResMap.get(resKey).repAtom = pAtom
            }

            // Classify non-covalent contact
            let type = null
            let color = null

            if (dist < 2.15) {
                type = 'Steric Clash'
                color = '#ef4444' // Red
            } else if (
                dist <= 4.0 &&
                ((isPositiveAtom(pAtom) && ['O', 'S'].includes((lAtom.elem || '').toUpperCase())) ||
                    (isNegativeAtom(pAtom) && (lAtom.elem || '').toUpperCase() === 'N'))
            ) {
                type = 'Salt Bridge'
                color = '#d946ef' // Magenta
            } else if (dist >= 2.2 && dist <= 3.5 && isPolar(pAtom.elem) && isPolar(lAtom.elem)) {
                type = 'H-Bond'
                color = '#06b6d4' // Cyan
            } else if (
                dist <= 4.0 &&
                AROMATIC_RESIDUES.has(resn) &&
                isCarbon(pAtom.elem) &&
                isCarbon(lAtom.elem)
            ) {
                type = 'π-Stack / Aromatic'
                color = '#8b5cf6' // Violet
            } else if (dist <= 4.0 && isCarbon(pAtom.elem) && isCarbon(lAtom.elem)) {
                type = 'Hydrophobic'
                color = '#f59e0b' // Amber
            }

            if (type) {
                const pairKey = `${resKey}:${type}`
                const existing = bestPairMap.get(pairKey)
                if (!existing || dist < existing.distance) {
                    bestPairMap.set(pairKey, {
                        id: pairKey,
                        type,
                        color,
                        distance: Number(dist.toFixed(2)),
                        proteinAtom: pAtom,
                        ligandAtom: lAtom,
                        residueLabel: `${resn}-${pAtom.resi} (${pAtom.chain || 'A'})`,
                        atomPairLabel: `${pAtom.atom || pAtom.elem} ↔ ${lAtom.atom || lAtom.elem}`
                    })
                }
            }
        }
    }

    const pocketResidues = Array.from(pocketResMap.values()).sort((a, b) => a.minDist - b.minDist)
    const sortedInteractions = Array.from(bestPairMap.values()).sort((a, b) => a.distance - b.distance)

    return {
        pocketResidues,
        interactions: sortedInteractions
    }
}

/**
 * Parse PDB / PDBQT / Docking Complex data, preserving both a unified sanitized receptor+ligand view
 * and extracting individual docking poses if multiple MODELs exist.
 */
export function parseMolecularDataAndPoses(rawData, ext = 'pdb') {
    const cleanExt = (ext || 'pdb').toLowerCase()
    if (!['pdb', 'pdbqt', 'ent'].includes(cleanExt)) {
        return { sanitizedData: rawData, poses: [] }
    }

    const ignoredPrefixes = ['ENDROOT', 'ROOT', 'BRANCH', 'ENDBRANCH', 'TORSDOF', 'USER', 'REMARK']
    const lines = rawData.split(/\r?\n/)

    // Check if there are explicit MODEL blocks
    const models = []
    let currentModelLines = null
    let staticReceptorLines = []
    const allSanitizedLines = []

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const recordType = line.substring(0, 6).trim().toUpperCase()

        if (recordType === 'MODEL') {
            currentModelLines = []
            continue
        }
        if (recordType === 'ENDMDL') {
            if (currentModelLines && currentModelLines.length > 0) {
                models.push(currentModelLines.join('\n'))
            }
            currentModelLines = null
            continue
        }

        if (ignoredPrefixes.some(p => trimmed.startsWith(p)) || recordType === 'END') {
            continue
        }

        if (recordType === 'ATOM' || recordType === 'HETATM') {
            const resn = line.length >= 20 ? line.substring(17, 20).trim().toUpperCase() : ''
            let updatedLine = line
            if (!STANDARD_RESIDUES.has(resn) && !WATER_RESIDUES.has(resn) && recordType === 'ATOM') {
                updatedLine = 'HETATM' + line.substring(6)
            }
            allSanitizedLines.push(updatedLine)
            if (currentModelLines !== null) {
                currentModelLines.push(updatedLine)
            } else {
                staticReceptorLines.push(updatedLine)
            }
        } else if (['CONECT', 'TER', 'MASTER', 'HEADER', 'COMPND'].includes(recordType)) {
            allSanitizedLines.push(line)
            if (currentModelLines !== null) {
                currentModelLines.push(line)
            } else {
                staticReceptorLines.push(line)
            }
        }
    }

    // If multiple MODELs exist, build pose snapshots (combining static receptor if present + model pose)
    const poses = models.length > 1
        ? models.map((mText, idx) => ({
            index: idx,
            label: `Pose ${idx + 1}`,
            pdbText: staticReceptorLines.length > 0
                ? `${staticReceptorLines.join('\n')}\n${mText}`
                : mText
        }))
        : []

    // Default sanitized data: if multiple poses exist, show Pose 1 by default (or all if user toggles)
    const sanitizedData = poses.length > 1
        ? poses[0].pdbText
        : allSanitizedLines.join('\n')

    return {
        sanitizedData,
        allPosesCombinedData: allSanitizedLines.join('\n'),
        poses
    }
}
