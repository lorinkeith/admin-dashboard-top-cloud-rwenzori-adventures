import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi'
import Sidebar from './Sidebar'
import SidebarBrand from './SidebarBrand'
import logoUrl from '../../assets/Fav_icon.png'
import { navigationItems } from '../../config/navigation'
import { supabase } from '../../lib/supabaseClient'
import { cn } from '../../utils/cn'

function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!isMobileMenuOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isMobileMenuOpen])

  return (
    <div className="min-h-screen bg-admin-background">
      <div className="flex min-h-screen">
        <Sidebar className="fixed inset-y-0 left-0 z-40 hidden lg:flex" />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-72">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-admin-border bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
            <img
              src={logoUrl}
              alt="Top Cloud Rwenzori Adventures"
              className="h-12 w-12 object-contain"
            />
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((isOpen) => !isOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-dark transition hover:border-admin-accent hover:text-admin-accent"
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMobileMenuOpen ? (
                <FiX className="h-5 w-5" aria-hidden="true" />
              ) : (
                <FiMenu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </header>

          {isMobileMenuOpen ? (
            <MobileNavigationDrawer onClose={() => setIsMobileMenuOpen(false)} />
          ) : null}

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}

function MobileNavigationDrawer({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase?.auth.signOut()
    onClose()
    navigate('/login', { replace: true })
  }

  const drawer = (
    <div className="fixed inset-0 z-[999] lg:hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/60"
      />
      <aside className="absolute left-0 top-0 flex h-dvh w-72 max-w-[86vw] flex-col bg-[#111827] px-5 py-6 text-white shadow-2xl">
        <div className="mb-9 flex items-start justify-between gap-4">
          <SidebarBrand />
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Close navigation menu"
          >
            <FiX className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white',
                    isActive && 'bg-admin-accent font-bold text-white shadow-[0_12px_28px_rgba(0,122,36,0.2)] hover:bg-admin-accent',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </NavLink>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={() => void handleLogout()}
          className="mt-8 flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <FiLogOut className="h-5 w-5" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </aside>
    </div>
  )

  return createPortal(drawer, document.body)
}

export default AdminLayout
