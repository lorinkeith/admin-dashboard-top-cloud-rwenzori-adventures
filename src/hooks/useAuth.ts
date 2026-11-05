import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => { if (active) setSession(data.session) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, value) => setSession(value))
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  return { session }
}
