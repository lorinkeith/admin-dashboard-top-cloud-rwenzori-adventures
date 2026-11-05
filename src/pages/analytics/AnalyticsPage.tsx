import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  FiAlertCircle,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiEye,
  FiImage,
  FiMail,
  FiRefreshCw,
  FiSearch,
  FiUsers,
} from 'react-icons/fi'
import PageHeader from '../../components/ui/PageHeader'
import { getAnalyticsData } from '../../services/analyticsService'
import { calculatePackagePerformance, sortPackagesByPerformance } from '../../utils/analyticsPerformance'
import type { AnalyticsDateFilter, AnalyticsOverview, PackageAnalyticsRow } from '../../types/analytics'
import type { PackagePerformanceResult, PerformanceLevel } from '../../utils/analyticsPerformance'

const pageSize = 5

const dateFilterOptions: Array<{ label: string; value: AnalyticsDateFilter }> = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 3 months', value: '3m' },
  { label: 'All time', value: 'all' },
]

const emptyOverview: AnalyticsOverview = {
  bookings: 0,
  inquiries: 0,
  totalViews: 0,
  uniqueVisitors: 0,
}

const kpiCards = [
  { icon: FiEye, key: 'totalViews', label: 'Total Views' },
  { icon: FiUsers, key: 'uniqueVisitors', label: 'Unique Visitors' },
  { icon: FiMail, key: 'inquiries', label: 'Inquiries' },
  { icon: FiCalendar, key: 'bookings', label: 'Bookings' },
] as const



const performanceStyles: Record<PerformanceLevel, { label: string; badge: string; bars: string }> = {
  top: {
    badge: 'bg-brand-50 text-[#007A24]',
    bars: 'bg-[#007A24]',
    label: 'Top Performer',
  },
  average: {
    badge: 'bg-amber-50 text-amber-700',
    bars: 'bg-amber-400',
    label: 'Average',
  },
  excellent: {
    badge: 'bg-emerald-50 text-emerald-700',
    bars: 'bg-emerald-500',
    label: 'Excellent',
  },
  good: {
    badge: 'bg-green-50 text-green-700',
    bars: 'bg-green-500',
    label: 'Good',
  },
  low: {
    badge: 'bg-red-50 text-red-600',
    bars: 'bg-red-500',
    label: 'Low',
  },
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatRank(index: number) {
  return String(index + 1).padStart(2, '0')
}

function formatPackageMeta(tourPackage: PackageAnalyticsRow) {
  const duration = tourPackage.durationDays > 0
    ? `${tourPackage.durationDays} ${tourPackage.durationDays === 1 ? 'day' : 'days'}`
    : ''
  return [duration, tourPackage.category].filter(Boolean).join(' • ')
}

function getPerformanceBars(tourPackage: PackagePerformanceResult) {
  if (tourPackage.performanceLevel === 'top' || tourPackage.performanceLevel === 'excellent') return 5
  if (tourPackage.performanceLevel === 'good') return 4
  if (tourPackage.performanceLevel === 'average') return 2
  return tourPackage.performanceScore > 0 ? 1 : 0
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) return [1, 2, 3, 'ellipsis', totalPages] as const
  if (currentPage >= totalPages - 2) return [1, 'ellipsis', totalPages - 2, totalPages - 1, totalPages] as const
  return [1, 'ellipsis-left', currentPage, 'ellipsis-right', totalPages] as const
}

function AnalyticsPage() {
  const [dateFilter, setDateFilter] = useState<AnalyticsDateFilter>('30d')
  const [packages, setPackages] = useState<PackageAnalyticsRow[]>([])
  const [overview, setOverview] = useState<AnalyticsOverview>(emptyOverview)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false)

  const rankedPackages = useMemo(() => sortPackagesByPerformance(calculatePackagePerformance(packages)), [packages])

  const filteredPackages = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    return searchTerm
      ? rankedPackages.filter((tourPackage) => (
          tourPackage.packageTitle.toLowerCase().includes(searchTerm) ||
          tourPackage.packageSlug.toLowerCase().includes(searchTerm) ||
          tourPackage.category.toLowerCase().includes(searchTerm)
        ))
      : rankedPackages
  }, [rankedPackages, search])
  const totalPages = Math.max(1, Math.ceil(filteredPackages.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageStartIndex = (currentPage - 1) * pageSize
  const visiblePackages = filteredPackages.slice(pageStartIndex, pageStartIndex + pageSize)
  const firstVisibleItem = filteredPackages.length === 0 ? 0 : pageStartIndex + 1
  const lastVisibleItem = Math.min(pageStartIndex + pageSize, filteredPackages.length)
  const selectedDateFilter = dateFilterOptions.find((option) => option.value === dateFilter) ?? dateFilterOptions[2]

  const loadAnalytics = useCallback(async (showRefreshState = false) => {
    setError('')
    setIsRefreshing(showRefreshState)

    if (!showRefreshState) {
      setIsLoading(true)
    }

    try {
      const data = await getAnalyticsData(dateFilter)
      setOverview(data.overview)
      setPackages(data.packages)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      console.error('Analytics load failed:', loadError)
      setOverview(emptyOverview)
      setPackages([])
      setError(message || 'Unable to load analytics.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [dateFilter])

  useEffect(() => {
    const timerId = window.setTimeout(() => void loadAnalytics(), 0)

    return () => window.clearTimeout(timerId)
  }, [loadAnalytics])


  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title="Tour Package Performance"
        description="Track how your tour packages are performing across views, engagement, inquiries and bookings."
      />

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <h2 className="text-base font-semibold text-red-800">Could not load analytics</h2>
                <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadAnalytics(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <FiRefreshCw className="h-4 w-4" />
              Retry
            </button>
          </div>
        </section>
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {kpiCards.map(({ icon: Icon, key, label }) => (
              <article key={key} className="rounded-2xl border border-admin-border bg-white p-4 shadow-sm sm:p-5">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-admin-accent sm:h-14 sm:w-14">
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-admin-muted">{label}</p>
                    <p className="mt-1 text-2xl font-bold leading-tight text-admin-accent sm:text-3xl">
                      {formatNumber(overview[key])}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="mt-6 grid grid-cols-[minmax(0,1fr)_9.5rem] gap-3 xl:grid-cols-[minmax(18rem,0.8fr)_auto] xl:items-center xl:justify-between">
            <label className="relative block min-w-0">
              <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted sm:left-4 sm:h-5 sm:w-5" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search packages..."
                className="h-12 w-full rounded-xl border border-admin-border bg-white pl-10 pr-3 text-sm font-semibold text-admin-dark shadow-sm outline-none transition placeholder:text-admin-muted focus:border-admin-accent focus:ring-4 focus:ring-brand-100 sm:h-14 sm:pl-12 sm:pr-4"
              />
            </label>

            <div className="xl:hidden">
              <button
                type="button"
                onClick={() => setIsDateFilterOpen((isOpen) => !isOpen)}
                className="flex h-12 w-full items-center justify-between gap-2 rounded-xl bg-brand-50 px-3 text-xs font-bold text-[#007A24] outline-none transition hover:bg-brand-100 focus:ring-4 focus:ring-brand-100"
                aria-expanded={isDateFilterOpen}
                aria-controls="analytics-mobile-date-filter"
              >
                <span className="truncate">{selectedDateFilter.label}</span>
                <FiChevronDown className={`h-4 w-4 shrink-0 transition ${isDateFilterOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {isDateFilterOpen ? (
              <div
                id="analytics-mobile-date-filter"
                className="col-span-2 grid gap-1 rounded-xl bg-white p-1.5 shadow-sm ring-1 ring-brand-100 xl:hidden"
              >
                {dateFilterOptions.map((option) => {
                  const isActive = dateFilter === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setDateFilter(option.value)
                        setPage(1)
                        setIsDateFilterOpen(false)
                      }}
                      className={`flex h-10 items-center rounded-lg px-3 text-left text-sm font-semibold transition ${
                        isActive
                          ? 'bg-brand-50 text-[#007A24]'
                          : 'text-admin-dark hover:bg-slate-50 hover:text-admin-accent'
                      }`}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            ) : null}

            <div className="hidden max-w-full overflow-x-auto rounded-xl border border-admin-border bg-white shadow-sm xl:flex">
              {dateFilterOptions.map((option) => {
                const isActive = dateFilter === option.value

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDateFilter(option.value)
                      setPage(1)
                    }}
                    className={`h-14 shrink-0 border-r border-admin-border px-5 text-sm font-semibold transition last:border-r-0 ${
                      isActive
                        ? 'bg-brand-50 text-[#007A24] ring-1 ring-inset ring-brand-200'
                        : 'text-admin-dark hover:bg-slate-50 hover:text-admin-accent'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="mt-6 overflow-hidden rounded-2xl border border-admin-border bg-white shadow-sm">
            {isRefreshing ? (
              <div className="flex items-center gap-2 border-b border-admin-border bg-brand-50 px-5 py-3 text-sm font-semibold text-brand-700">
                <FiRefreshCw className="h-4 w-4 animate-spin" />
                Refreshing analytics
              </div>
            ) : null}

            {packages.length === 0 ? (
              <p className="px-5 py-10 text-sm font-semibold text-admin-muted">No package analytics yet.</p>
            ) : filteredPackages.length === 0 ? (
              <p className="px-5 py-10 text-sm font-semibold text-admin-muted">No packages match your search.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-[1040px] w-full table-fixed divide-y divide-admin-border">
                    <colgroup>
                      <col className="w-[5%]" />
                      <col className="w-[28%]" />
                      <col className="w-[11%]" />
                      <col className="w-[14%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                      <col className="w-[15%]" />
                    </colgroup>
                    <thead className="bg-slate-50">
                      <tr>
                        {['#', 'Package', 'Views', 'Unique Visitors', 'Inquiries', 'Bookings', 'Performance'].map((heading) => (
                          <th key={heading} className="px-5 py-4 text-left text-[0.7rem] font-bold uppercase tracking-wide text-admin-muted">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-admin-border bg-white">
                      {visiblePackages.map((tourPackage, index) => {
                        const absoluteIndex = pageStartIndex + index
                        const performanceStyle = performanceStyles[tourPackage.performanceLevel]
                        const activeBars = getPerformanceBars(tourPackage)

                        return (
                          <tr key={tourPackage.tourId} className="transition hover:bg-brand-50/30">
                            <td className="px-5 py-4">
                              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-sm font-bold text-[#007A24]">
                                {formatRank(absoluteIndex)}
                              </span>
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex min-w-0 items-center gap-4">
                                <div className="grid h-[74px] w-[74px] shrink-0 place-items-center overflow-hidden rounded-lg border border-admin-border bg-slate-100">
                                  {tourPackage.imageUrl ? (
                                    <img src={tourPackage.imageUrl} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <FiImage className="h-5 w-5 text-admin-muted" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="line-clamp-2 text-sm font-bold leading-5 text-admin-dark">{tourPackage.packageTitle}</p>
                                  <p className="mt-1 truncate text-xs font-semibold text-admin-muted">{formatPackageMeta(tourPackage) || `/${tourPackage.packageSlug}`}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-lg font-semibold text-admin-dark">{formatNumber(tourPackage.views)}</td>
                            <td className="px-5 py-4 text-lg font-semibold text-admin-dark">{formatNumber(tourPackage.uniqueVisitors)}</td>
                            <td className="px-5 py-4 text-lg font-semibold text-admin-dark">{formatNumber(tourPackage.inquiries)}</td>
                            <td className="px-5 py-4 text-lg font-semibold text-admin-dark">{formatNumber(tourPackage.bookings)}</td>
                            <td className="px-5 py-4">
                              <span className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold ${performanceStyle.badge}`}>
                                {performanceStyle.label}
                              </span>
                              <div className="mt-3 flex gap-1.5">
                                {[0, 1, 2, 3, 4].map((bar) => (
                                  <span
                                    key={bar}
                                    className={`h-1.5 w-6 rounded-full ${bar < activeBars ? performanceStyle.bars : 'bg-slate-200'}`}
                                  />
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-4 border-t border-admin-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold text-admin-muted">
                    Showing {firstVisibleItem} to {lastVisibleItem} of {filteredPackages.length} packages
                  </p>
                  {totalPages > 1 ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <PaginationButton
                        label="Previous page"
                        disabled={currentPage === 1}
                        onClick={() => setPage((nextPage) => Math.max(1, nextPage - 1))}
                      >
                        <FiChevronLeft className="h-4 w-4" />
                      </PaginationButton>
                      {getVisiblePageNumbers(currentPage, totalPages).map((item) => (
                        typeof item === 'number' ? (
                          <PaginationButton
                            key={item}
                            isActive={item === currentPage}
                            label={`Page ${item}`}
                            onClick={() => setPage(item)}
                          >
                            {item}
                          </PaginationButton>
                        ) : (
                          <span key={item} className="px-2 text-sm font-semibold text-admin-muted">...</span>
                        )
                      ))}
                      <PaginationButton
                        label="Next page"
                        disabled={currentPage === totalPages}
                        onClick={() => setPage((nextPage) => Math.min(totalPages, nextPage + 1))}
                      >
                        <FiChevronRight className="h-4 w-4" />
                      </PaginationButton>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function PaginationButton({
  children,
  disabled = false,
  isActive = false,
  label,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  isActive?: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-10 min-w-10 place-items-center rounded-lg border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        isActive
          ? 'border-admin-accent bg-brand-50 text-[#007A24]'
          : 'border-admin-border bg-white text-admin-dark hover:border-admin-accent hover:text-admin-accent'
      }`}
    >
      {children}
    </button>
  )
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <article key={item} className="rounded-2xl border border-admin-border bg-white p-4 shadow-sm sm:p-5">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="h-14 w-14 animate-pulse rounded-full bg-brand-50" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-200" />
              </div>
            </div>
          </article>
        ))}
      </section>
      <section className="rounded-2xl border border-admin-border bg-white p-6 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </section>
    </div>
  )
}

export default AnalyticsPage

