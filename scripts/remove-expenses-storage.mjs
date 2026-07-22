// One-time cleanup: empty and delete the `travel-receipts` storage bucket.
// Supabase blocks deleting storage rows via SQL, so this uses the Storage API
// with the service-role key from .env.local.
//
//   node scripts/remove-expenses-storage.mjs
//
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// --- load .env.local (no extra deps) ---
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const url = env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const BUCKET = 'travel-receipts'
const supabase = createClient(url, key, { auth: { persistSession: false } })

// Recursively collect every object path under a prefix.
async function listAll(prefix = '') {
  const paths = []
  let offset = 0
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100, offset })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name
      // Folders have no `id`; recurse into them.
      if (item.id === null || item.id === undefined) paths.push(...(await listAll(full)))
      else paths.push(full)
    }
    if (data.length < 100) break
    offset += 100
  }
  return paths
}

async function main() {
  // Confirm the bucket exists.
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets()
  if (bErr) throw bErr
  if (!buckets.some(b => b.name === BUCKET)) {
    console.log(`Bucket "${BUCKET}" not found — nothing to do.`)
    return
  }

  const files = await listAll()
  console.log(`Found ${files.length} file(s) in "${BUCKET}".`)

  if (files.length > 0) {
    // remove() handles up to ~1000 paths per call; chunk to be safe.
    for (let i = 0; i < files.length; i += 500) {
      const chunk = files.slice(i, i + 500)
      const { error } = await supabase.storage.from(BUCKET).remove(chunk)
      if (error) throw error
      console.log(`Deleted ${Math.min(i + 500, files.length)}/${files.length}`)
    }
  }

  const { error: delErr } = await supabase.storage.deleteBucket(BUCKET)
  if (delErr) throw delErr
  console.log(`Bucket "${BUCKET}" deleted. Storage cleanup complete.`)
}

main().catch(e => { console.error('Failed:', e.message); process.exit(1) })
