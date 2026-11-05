import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

// Reports statuses only: never prints keys, environment contents or customer data.
// Remote probes only read data; no login, uploads, analytics or test submissions.
const apps = [
  ['website', new URL('../../top-cloud-rwenzori-adventures/', import.meta.url)],
  ['dashboard', new URL('../', import.meta.url)],
]
let failures = 0
const report = (ok, label) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`)
  if (!ok) failures++
}
const targets = new Map()
for (const mode of ['development', 'production']) {
  const environments = apps.map(([name, directory]) => {
    const env = loadEnv(mode, fileURLToPath(directory), '')
    const url = env.VITE_SUPABASE_URL?.trim()
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
    const valid = Boolean(url && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key?.startsWith('sb_publishable_') && !/YOUR_|PLACEHOLDER/i.test(key))
    report(valid, `${name} ${mode}: frontend configuration`)
    report(Boolean(valid && env.SUPABASE_URL?.trim() === url && env.SUPABASE_PUBLISHABLE_KEY?.trim() === key), `${name} ${mode}: server uses the frontend project and key`)
    if (valid) targets.set(`${url}\n${key}`, { url, key })
    return { url, key, valid }
  })
  report(environments.every(env => env.valid) && environments[0].url === environments[1].url && environments[0].key === environments[1].key, `${mode}: both apps use the same project and key`)
}

if (!process.argv.includes('--env-only') && failures === 0) {
  const schema = await readFile(new URL('../supabase/setup/01_schema.sql', import.meta.url), 'utf8')
  const privateTables = new Set(['form_submissions', 'homepage_customizations', 'hero_slider_admins', 'tour_analytics_events'])
  const tables = [...schema.matchAll(/create table if not exists public\.(\w+) \(([\s\S]*?)^\);/gim)]
  for (const { url, key } of targets.values()) {
    const probe = async (path, label, { privateRead = false, rpc = false } = {}) => {
      try {
        const response = await fetch(`${url}/rest/v1/${path}`, {
          method: rpc ? 'POST' : 'GET',
          headers: { apikey: key, ...(rpc ? { 'Content-Type': 'application/json' } : {}) },
          ...(rpc ? { body: '{}' } : {}),
          signal: AbortSignal.timeout(15000),
        })
        const data = await response.json().catch(() => null)
        const ok = privateRead ? [401, 403].includes(response.status) && data?.code === '42501' : response.ok
        report(ok, `${label}: HTTP ${response.status}${data?.code && /^[A-Z0-9]+$/.test(data.code) ? ` (${data.code})` : ''}`)
      } catch (error) {
        const code = error.cause?.code || error.name
        report(false, `${label}: network request failed (${String(code).replace(/[^a-z0-9_]/gi, '')})`)
      }
    }
    await Promise.all(tables.map(([, table, definition]) => {
      const columns = [...definition.matchAll(/^  ([a-z_]+) (?:uuid|text|integer|numeric|double|timestamptz|timestamp|boolean|jsonb|int)\b/gim)].map(match => match[1])
      return probe(`${table}?select=${columns.join(',')}&limit=0`, `${table}${privateTables.has(table) ? ' blocks anonymous reads' : ' public columns'}`, { privateRead: privateTables.has(table) })
    }))
    await Promise.all(['get_published_homepage', 'get_published_hero_slider'].map(name => probe(`rpc/${name}`, name, { rpc: true })))
  }
}
console.log(failures ? `${failures} check(s) failed. See SUPABASE_SETUP_GUIDE.md; PGRST205 means a missing table/schema-cache entry.` : 'Checks passed. Admin login, uploads, publication and form submission still require the browser checklist in SUPABASE_SETUP_GUIDE.md.')
process.exitCode = failures ? 1 : 0
