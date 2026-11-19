import { createClient } from '@supabase/supabase-js'

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const isConfigured =
    Boolean(envUrl) &&
    Boolean(envKey) &&
    !envUrl.includes('placeholder-url') &&
    !envKey.includes('placeholder-anon-key')

function createLocalDemoSupabase() {
    const STORAGE_KEY = 'molshare_local_demo_db_v1'
    const SESSION_KEY = 'molshare_local_demo_session_v1'
    const authListeners = new Set()

    const defaultUser = {
        id: 'demo-user-001',
        email: 'demo@molshare.com',
        user_metadata: { full_name: 'Demo Researcher' }
    }

    const readDb = () => {
        if (typeof window === 'undefined') {
            return { profiles: [], projects: [], project_files: [], project_views: [], annotations: [], comments: [], files: {} }
        }
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY)
            if (raw) return JSON.parse(raw)
        } catch (e) {
            console.warn('Local demo DB read error:', e)
        }

        // Seed initial demo data so the Repository feels alive out of the box
        const now = new Date().toISOString()
        const seed = {
            profiles: [
                { id: 'demo-user-001', email: 'demo@molshare.com', full_name: 'Demo Researcher' },
                { id: 'collab-user-002', email: 'lab.partner@molshare.com', full_name: 'Dr. Elena Rostova' }
            ],
            projects: [
                {
                    id: 'proj-vina-demo',
                    owner_id: 'demo-user-001',
                    title: 'AutoDock Vina Complex (Sample)',
                    file_url: '/sample_vina_complex.pdb',
                    file_extension: 'pdb',
                    csv_file_url: null,
                    csv_file_name: null,
                    is_public: true,
                    notes: 'Sample docked receptor-ligand complex. Try switching to Pocket View, measuring interatomic distances, or uploading a new version!',
                    created_at: now
                },
                {
                    id: 'proj-shared-demo',
                    owner_id: 'collab-user-002',
                    title: '4HHB Hemoglobin Tetramer (Shared)',
                    file_url: 'https://files.rcsb.org/download/4HHB.pdb',
                    file_extension: 'pdb',
                    csv_file_url: null,
                    csv_file_name: null,
                    is_public: true,
                    notes: 'Shared by Dr. Elena Rostova for binding site review.',
                    created_at: now
                }
            ],
            project_files: [
                {
                    id: 'file-vina-v1',
                    project_id: 'proj-vina-demo',
                    owner_id: 'demo-user-001',
                    file_url: '/sample_vina_complex.pdb',
                    file_extension: 'pdb',
                    file_name: 'webvina_complex.pdb',
                    version_number: 1,
                    parent_version_id: null,
                    sort_order: 0,
                    created_at: now
                },
                {
                    id: 'file-shared-v1',
                    project_id: 'proj-shared-demo',
                    owner_id: 'collab-user-002',
                    file_url: 'https://files.rcsb.org/download/4HHB.pdb',
                    file_extension: 'pdb',
                    file_name: '4HHB.pdb',
                    version_number: 1,
                    parent_version_id: null,
                    sort_order: 0,
                    created_at: now
                }
            ],
            project_views: [
                { id: 'view-1', project_id: 'proj-shared-demo', viewer_id: 'demo-user-001', viewed_at: now }
            ],
            annotations: [],
            comments: [
                {
                    id: 'comment-1',
                    project_id: 'proj-vina-demo',
                    user_id: 'collab-user-002',
                    content: 'Check the hydrogen bond interactions around the docked UNL ligand!',
                    created_at: now
                }
            ],
            files: {}
        }
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed))
        } catch (e) {
            console.warn('Local demo DB seed write error:', e)
        }
        return seed
    }

    const writeDb = (db) => {
        if (typeof window === 'undefined') return
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
        } catch (e) {
            console.warn('Local demo DB write error (storage quota):', e)
        }
    }

    const getSessionObj = () => {
        if (typeof window === 'undefined') return null
        try {
            const raw = window.localStorage.getItem(SESSION_KEY)
            if (!raw) return null
            const user = JSON.parse(raw)
            return { user }
        } catch {
            return null
        }
    }

    const setSessionUser = (user) => {
        if (typeof window === 'undefined') return
        if (user) {
            window.localStorage.setItem(SESSION_KEY, JSON.stringify(user))
            const db = readDb()
            if (!db.profiles.some(p => p.id === user.id)) {
                db.profiles.push({
                    id: user.id,
                    email: user.email,
                    full_name: user.user_metadata?.full_name || user.email.split('@')[0]
                })
                writeDb(db)
            }
        } else {
            window.localStorage.removeItem(SESSION_KEY)
        }
        const session = user ? { user } : null
        authListeners.forEach(cb => {
            try {
                cb(user ? 'SIGNED_IN' : 'SIGNED_OUT', session)
            } catch (err) {
                console.error(err)
            }
        })
    }

    const auth = {
        async getUser() {
            const sess = getSessionObj()
            return { data: { user: sess?.user || null }, error: null }
        },
        async getSession() {
            const sess = getSessionObj()
            return { data: { session: sess }, error: null }
        },
        onAuthStateChange(cb) {
            authListeners.add(cb)
            const sess = getSessionObj()
            setTimeout(() => cb(sess ? 'INITIAL_SESSION' : 'SIGNED_OUT', sess), 0)
            return {
                data: {
                    subscription: {
                        unsubscribe: () => authListeners.delete(cb)
                    }
                }
            }
        },
        async signInWithPassword({ email }) {
            const cleanEmail = (email || 'demo@molshare.com').trim()
            const user = cleanEmail === 'demo@molshare.com'
                ? defaultUser
                : {
                    id: 'user-' + cleanEmail.toLowerCase().replace(/[^a-z0-9]/g, '-'),
                    email: cleanEmail,
                    user_metadata: { full_name: cleanEmail.split('@')[0] }
                }
            setSessionUser(user)
            return { data: { user, session: { user } }, error: null }
        },
        async signUp({ email }) {
            return this.signInWithPassword({ email })
        },
        async signInWithOAuth() {
            setSessionUser(defaultUser)
            if (typeof window !== 'undefined') {
                window.location.href = '/dashboard'
            }
            return { data: { user: defaultUser, session: { user: defaultUser } }, error: null }
        },
        async signOut() {
            setSessionUser(null)
            return { error: null }
        }
    }

    const storage = {
        from() {
            return {
                async upload(path, file) {
                    const text = await new Promise((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = () => resolve(reader.result)
                        reader.onerror = reject
                        reader.readAsDataURL(file)
                    })
                    const db = readDb()
                    db.files[path] = text
                    writeDb(db)
                    return { data: { path }, error: null }
                },
                getPublicUrl(path) {
                    const db = readDb()
                    const dataUrl = db.files[path] || '/sample_vina_complex.pdb'
                    return { data: { publicUrl: dataUrl } }
                },
                async remove(paths) {
                    const db = readDb()
                    ;(paths || []).forEach(p => { delete db.files[p] })
                    writeDb(db)
                    return { data: [], error: null }
                }
            }
        }
    }

    function createQueryBuilder(table) {
        let op = 'select'
        let selectCols = '*'
        let payloadData = null
        const filters = []
        const orders = []
        let wantSingle = false

        const run = () => {
            const db = readDb()
            const rows = db[table] || []

            const matches = (row) => filters.every(f => {
                if (f.type === 'eq') return row[f.col] === f.val
                if (f.type === 'in') return Array.isArray(f.val) && f.val.includes(row[f.col])
                return true
            })

            if (op === 'insert') {
                const items = Array.isArray(payloadData) ? payloadData : [payloadData]
                const inserted = items.map((item, idx) => ({
                    id: item.id || `${table}-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
                    created_at: item.created_at || new Date().toISOString(),
                    viewed_at: item.viewed_at || new Date().toISOString(),
                    ...item
                }))
                db[table] = [...rows, ...inserted]
                writeDb(db)
                const out = wantSingle ? (inserted[0] || null) : inserted
                return { data: out, error: null }
            }

            if (op === 'update') {
                const updated = []
                db[table] = rows.map(r => {
                    if (matches(r)) {
                        const u = { ...r, ...payloadData }
                        updated.push(u)
                        return u
                    }
                    return r
                })
                writeDb(db)
                return { data: wantSingle ? (updated[0] || null) : updated, error: null }
            }

            if (op === 'delete') {
                db[table] = rows.filter(r => !matches(r))
                writeDb(db)
                return { data: null, error: null }
            }

            // SELECT
            let result = rows.filter(matches).map(r => {
                const copy = { ...r }
                if (table === 'projects') {
                    if (selectCols.includes('project_views')) {
                        const count = (db.project_views || []).filter(v => v.project_id === r.id).length
                        copy.project_views = [{ count }]
                    }
                    if (selectCols.includes('project_files')) {
                        const count = (db.project_files || []).filter(f => f.project_id === r.id).length
                        copy.project_files = [{ count }]
                    }
                }
                if (selectCols.includes('profiles')) {
                    const uid = r.user_id || r.owner_id
                    const prof = (db.profiles || []).find(p => p.id === uid) || null
                    copy.profiles = prof
                }
                return copy
            })

            if (orders.length > 0) {
                result.sort((a, b) => {
                    for (const o of orders) {
                        const av = a[o.col] ?? ''
                        const bv = b[o.col] ?? ''
                        if (av < bv) return o.asc ? -1 : 1
                        if (av > bv) return o.asc ? 1 : -1
                    }
                    return 0
                })
            }

            if (wantSingle) {
                return { data: result[0] || null, error: null }
            }
            return { data: result, error: null }
        }

        const builder = {
            select(cols = '*') {
                selectCols = cols
                return builder
            },
            insert(data) {
                op = 'insert'
                payloadData = data
                return builder
            },
            update(data) {
                op = 'update'
                payloadData = data
                return builder
            },
            delete() {
                op = 'delete'
                return builder
            },
            eq(col, val) {
                filters.push({ type: 'eq', col, val })
                return builder
            },
            in(col, val) {
                filters.push({ type: 'in', col, val })
                return builder
            },
            order(col, opts = { ascending: true }) {
                orders.push({ col, asc: opts?.ascending !== false })
                return builder
            },
            single() {
                wantSingle = true
                return builder
            },
            then(resolve, reject) {
                try {
                    resolve(run())
                } catch (err) {
                    if (reject) reject(err)
                }
            }
        }
        return builder
    }

    return {
        auth,
        storage,
        from: (table) => createQueryBuilder(table),
        channel: () => ({
            on() { return this },
            subscribe() { return this }
        }),
        removeChannel: () => {}
    }
}

export const supabase = isConfigured
    ? createClient(envUrl, envKey)
    : createLocalDemoSupabase()
