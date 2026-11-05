import { useCallback, useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { FiLogOut } from 'react-icons/fi'
import SidebarBrand from './SidebarBrand'
import { navigationItems } from '../../config/navigation'
import { supabase } from '../../lib/supabaseClient'
import {
  getNewSubmissionBadgeItems,
  type NewSubmissionCounts,
} from '../../services/formSubmissionService'
import { cn } from '../../utils/cn'

type SidebarProps = {
  className?: string
  onNavigate?: () => void
}

function Sidebar({ className = '', onNavigate }: SidebarProps) {
  const navigate = useNavigate()
  const [badgeCounts, setBadgeCounts] = useState<NewSubmissionCounts>({
    bookings: 0,
    inquiries: 0,
  })

  const getViewedSubmissionIds = () => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem('topcloud:viewedSubmissionIds') || '[]') as string[])
    } catch {
      return new Set<string>()
    }
  }

  const loadBadgeCounts = useCallback(async () => {
    try {
      const viewedIds = getViewedSubmissionIds()
      const newItems = await getNewSubmissionBadgeItems()
      const unseenItems = newItems.filter((item) => !viewedIds.has(item.id))

      setBadgeCounts({
        bookings: unseenItems.filter((item) => item.type === 'booking').length,
        inquiries: unseenItems.filter((item) => item.type === 'inquiry').length,
      })
    } catch {
      setBadgeCounts({ bookings: 0, inquiries: 0 })
    }
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => void loadBadgeCounts(), 0)
    const intervalId = window.setInterval(() => void loadBadgeCounts(), 30000)

    window.addEventListener('focus', loadBadgeCounts)
    window.addEventListener('submission-counts-changed', loadBadgeCounts)

    const channel = supabase
      ?.channel('form-submissions-sidebar-badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_submissions' }, () => {
        void loadBadgeCounts()
      })
      .subscribe()

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(intervalId)
      window.removeEventListener('focus', loadBadgeCounts)
      window.removeEventListener('submission-counts-changed', loadBadgeCounts)
      if (channel) {
        void supabase?.removeChannel(channel)
      }
    }
  }, [loadBadgeCounts])

  const handleLogout = async () => {
    await supabase?.auth.signOut()
    onNavigate?.()
    navigate('/login', { replace: true })
  }

  return (
    <aside className={cn('flex h-screen w-72 shrink-0 flex-col overflow-y-auto bg-admin-sidebar px-5 py-6 text-white', className)}>
      <div className="mb-9">
        <SidebarBrand />
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const badgeCount = item.badgeKey ? badgeCounts[item.badgeKey] : 0

          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:bg-admin-accent focus-visible:text-white focus-visible:ring-2 focus-visible:ring-admin-accent/40',
                  isActive && 'bg-admin-accent font-bold text-white shadow-[0_12px_28px_rgba(0,122,36,0.2)] hover:bg-admin-accent',
                )
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {badgeCount > 0 ? (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-admin-accent px-1.5 text-[0.68rem] font-bold leading-none text-white shadow-[0_8px_18px_rgba(0,122,36,0.25)]">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-8 flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
      >
        <FiLogOut className="h-5 w-5" aria-hidden="true" />
        <span>Logout</span>
      </button>
    </aside>
  )
}

export default Sidebar
