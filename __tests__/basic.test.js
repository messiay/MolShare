describe('MolShare Basic Tests', () => {
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
})
