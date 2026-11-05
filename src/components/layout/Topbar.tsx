import { NavLink, useLocation } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'
import { cn } from '../../utils/cn'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/packages': 'Tour Packages',
  '/packages/new': 'New Tour Package',
  '/bookings': 'Bookings',
  '/inquiries': 'Inquiries',
  '/settings': 'Settings',
}

function getPageTitle(pathname: string) {
  if (pathname.startsWith('/packages/') && pathname.endsWith('/edit')) {
    return 'Edit Tour Package'
  }

  return pageTitles[pathname] ?? 'Admin Dashboard'
}

function Topbar() {
  const location = useLocation()

  return (
    <header className="sticky top-0 z-20 border-b border-admin-border bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-admin-muted">
              Top Cloud Rwenzori Adventures
            </p>
            <h2 className="mt-1 text-xl font-semibold text-admin-dark">
              {getPageTitle(location.pathname)}
            </h2>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-admin-border bg-white px-3 py-2 shadow-sm">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-admin-accent">
              A
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold text-admin-dark">Admin</p>
              <p className="text-xs text-admin-muted">Private CMS</p>
            </div>
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-w-max items-center gap-2 rounded-full border border-admin-border bg-white px-3 py-2 text-sm font-medium text-admin-muted',
                    isActive && 'border-admin-accent bg-brand-50 text-admin-accent',
                  )
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default Topbar
