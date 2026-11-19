import {
  calcDistance,
  calcAngle,
  calcDihedral,
  calcCentroid,
  getScientificAtomColor,
  analyzeStructureHierarchy,
  computeBindingPocketInteractions,
  parseMolecularDataAndPoses
} from '../utils/molAnalyzer'

describe('MolShare Basic & 3D Workstation Analyzer Tests', () => {
  test('Environment variables are defined or defaultable', () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
    expect(supabaseUrl).toBeDefined()
  })

  test('App name is correct', () => {
    const appName = 'MolShare'
    expect(appName).toBe('MolShare')
  })

  test('Supported molecule formats are valid', () => {
    const formats = ['pdb', 'sdf', 'mol2', 'xyz', 'cif', 'cube', 'pqr']
    expect(formats).toContain('pdb')
    expect(formats).toContain('sdf')
    expect(formats.length).toBeGreaterThanOrEqual(5)
  })

  test('Geometric calculations (Distance, Angle, Dihedral, Centroid) are accurate', () => {
    const a = { x: 0, y: 0, z: 0 }
    const b = { x: 3, y: 4, z: 0 }
    expect(calcDistance(a, b)).toBeCloseTo(5.0, 4)

    const p1 = { x: 1, y: 0, z: 0 }
    const p2 = { x: 0, y: 0, z: 0 }
    const p3 = { x: 0, y: 1, z: 0 }
    expect(calcAngle(p1, p2, p3)).toBeCloseTo(90.0, 2)

    const d1 = { x: 1, y: 0, z: 0 }
    const d2 = { x: 0, y: 0, z: 0 }
    const d3 = { x: 0, y: 1, z: 0 }
    const d4 = { x: 0, y: 1, z: 1 }
    expect(Math.abs(calcDihedral(d1, d2, d3, d4))).toBeCloseTo(90.0, 2)

    const center = calcCentroid([a, b])
    expect(center.x).toBeCloseTo(1.5)
    expect(center.y).toBeCloseTo(2.0)
  })

  test('Scientific color mappers (pLDDT, Hydrophobicity, Charge) return valid colors', () => {
    expect(getScientificAtomColor({ resn: 'ALA', b: 95 }, 'plddt')).toBe('#0053D6')
    expect(getScientificAtomColor({ resn: 'ALA', b: 40 }, 'plddt')).toBe('#FF7D45')
    expect(getScientificAtomColor({ resn: 'ARG' }, 'charge')).toBe('#2563eb')
    expect(getScientificAtomColor({ resn: 'ASP' }, 'charge')).toBe('#dc2626')
    expect(getScientificAtomColor({ resn: 'ILE' }, 'hydrophobicity')).toMatch(/^rgb\(/)
  })

  test('Structure hierarchy & non-covalent binding pocket detector work accurately', () => {
    const sampleAtoms = [
      { serial: 1, atom: 'CA', elem: 'C', resn: 'SER', resi: 195, chain: 'A', hetflag: false, b: 88, x: 0, y: 0, z: 0 },
      { serial: 2, atom: 'OG', elem: 'O', resn: 'SER', resi: 195, chain: 'A', hetflag: false, b: 85, x: 1.5, y: 0, z: 0 },
      { serial: 3, atom: 'O1', elem: 'O', resn: 'UNL', resi: 1, chain: 'A', hetflag: true, b: 50, x: 4.3, y: 0, z: 0 },
      { serial: 4, atom: 'O', elem: 'O', resn: 'HOH', resi: 401, chain: 'A', hetflag: true, b: 30, x: 10, y: 10, z: 10 }
    ]

    const hier = analyzeStructureHierarchy(sampleAtoms)
    expect(hier.chains.length).toBe(1)
    expect(hier.chains[0].residues[0].code).toBe('S')
    expect(hier.ligands.length).toBe(1)
    expect(hier.waterCount).toBe(1)

    const pocket = computeBindingPocketInteractions(sampleAtoms, hier.ligands[0].atoms, 4.5)
    expect(pocket.pocketResidues.length).toBe(1)
    expect(pocket.interactions.length).toBe(1)
    expect(pocket.interactions[0].type).toBe('H-Bond')
    expect(pocket.interactions[0].distance).toBeCloseTo(2.8, 1)
  })

  test('Multi-pose PDB/Vina complex parser extracts poses and converts non-standard ATOM to HETATM', () => {
    const samplePdb = [
      'ATOM      1  CA  ALA A   1       0.000   0.000   0.000  1.00 20.00           C',
      'MODEL 1',
      'ATOM     10  C1  UNL A   1       2.000   2.000   2.000  1.00  0.00           C',
      'ENDMDL',
      'MODEL 2',
      'ATOM     10  C1  UNL A   1       3.000   3.000   3.000  1.00  0.00           C',
      'ENDMDL'
    ].join('\n')

    const parsed = parseMolecularDataAndPoses(samplePdb, 'pdb')
    expect(parsed.poses.length).toBe(2)
    expect(parsed.sanitizedData).toContain('HETATM   10  C1  UNL')
  })
})
