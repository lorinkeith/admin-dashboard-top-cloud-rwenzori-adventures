import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const hasSupabaseConfig = Boolean(url && /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url) && key?.startsWith('sb_publishable_'))
export const supabase = hasSupabaseConfig
  ? createClient(url!, key!, { auth: { storageKey: 'topcloud-admin-auth', persistSession: true } })
  : null
