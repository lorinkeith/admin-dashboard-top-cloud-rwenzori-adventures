import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'

type ProtectedRouteProps = {
  children: ReactNode
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) {
      return
    }

    let isMounted = true

    let checkVersion = 0
    const check = async (activeSession: Session | null) => {
      const version = ++checkVersion
      if (!activeSession) {
        if (isMounted) { setSession(null); setAuthorized(false); setIsLoading(false) }
        return
      }
      const result = await supabase!.rpc('is_admin')
      if (!isMounted || version !== checkVersion) return
      setSession(activeSession)
      setAuthorized(!result.error && result.data === true)
      setIsLoading(false)
    }
    void supabase.auth.getSession().then(({ data }) => check(data.session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, activeSession) => {
      // Defer database calls until the Auth callback releases its lock.
      setTimeout(() => { if (isMounted) void check(activeSession) }, 0)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-admin-background px-4">
        <div className="rounded-lg border border-admin-border bg-white px-6 py-5 text-sm font-medium text-admin-muted shadow-soft">
          Checking admin session...
        </div>
      </div>
    )
  }

  if (!session || !authorized) {
    return <Navigate to="/login" replace />
  }

  return children
}

export default ProtectedRoute
