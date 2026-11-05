import { useCallback, useEffect, useMemo, useState } from 'react'
import type React from 'react'
import {
  FiAlertTriangle,
  FiEye,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import EmptyState from '../ui/EmptyState'
import PageHeader from '../ui/PageHeader'
import { supabase } from '../../lib/supabaseClient'
import {
  deleteFormSubmission,
  deleteFormSubmissions,
  getFormSubmissions,
  getNewSubmissionBadgeItems,
} from '../../services/formSubmissionService'
import type {
  FormSubmission,
  FormSubmissionStatus,
  FormSubmissionType,
  SubmissionDateFilter,
} from '../../types/formSubmission'

type SortMode = 'newest' | 'oldest' | 'status'

type SubmissionsPageViewProps = {
  type: FormSubmissionType
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
}

const pageSize = 20

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string | null) {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Not provided' : dateFormatter.format(date)
}

function formatType(type: FormSubmissionType) {
  return type === 'booking' ? 'Booking' : 'Inquiry'
}

function getPreview(submission: FormSubmission) {
  return submission.type === 'booking'
    ? submission.special_requests || submission.tour_package_name || 'Booking request'
    : submission.message || 'General inquiry'
}

function getPackageName(submission: FormSubmission) {
  return submission.tour_packages?.title || submission.tour_package_name || 'Not linked'
}

function statusClasses(status: FormSubmissionStatus) {
  return status === 'processed'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-brand-200 bg-brand-50 text-brand-700'
}

function readStatusClasses(isUnread: boolean) {
  return isUnread
    ? 'border-brand-200 bg-brand-50 text-brand-700'
    : 'border-slate-200 bg-slate-50 text-slate-600'
}

function getReadStatus(submission: FormSubmission, viewedIds: Set<string>) {
  return submission.status === 'new' && !viewedIds.has(submission.id) ? 'New' : 'Seen'
}

function typeClasses(type: FormSubmissionType) {
  return type === 'booking'
    ? 'border-brand-200 bg-brand-50 text-brand-700'
    : 'border-sky-200 bg-sky-50 text-sky-700'
}

function sortedSubmissions(submissions: FormSubmission[], sortMode: SortMode) {
  const nextSubmissions = [...submissions]

  if (sortMode === 'oldest') {
    return nextSubmissions.sort((first, second) => (
      new Date(first.created_at).getTime() - new Date(second.created_at).getTime()
    ))
  }

  if (sortMode === 'status') {
    return nextSubmissions.sort((first, second) => {
      if (first.status === second.status) {
        return new Date(second.created_at).getTime() - new Date(first.created_at).getTime()
      }

      return first.status === 'new' ? -1 : 1
    })
  }

  return nextSubmissions
}

export function SubmissionsPageView({
  type,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: SubmissionsPageViewProps) {
  const [submissions, setSubmissions] = useState<FormSubmission[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [dateFilter, setDateFilter] = useState<SubmissionDateFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null)
  const [submissionToDelete, setSubmissionToDelete] = useState<FormSubmission | null>(null)
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([])
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewedSubmissionIds, setViewedSubmissionIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(window.localStorage.getItem('topcloud:viewedSubmissionIds') || '[]') as string[])
    } catch {
      return new Set<string>()
    }
  })

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const visibleSubmissions = useMemo(
    () => sortedSubmissions(submissions, sortMode),
    [sortMode, submissions],
  )
  const newCount = useMemo(
    () => submissions.filter((submission) => submission.status === 'new' && !viewedSubmissionIds.has(submission.id)).length,
    [submissions, viewedSubmissionIds],
  )
  const selectedSubmissions = useMemo(
    () => visibleSubmissions.filter((submission) => selectedSubmissionIds.includes(submission.id)),
    [selectedSubmissionIds, visibleSubmissions],
  )
  const hasSelection = selectedSubmissionIds.length > 0
  const isAllSelected = visibleSubmissions.length > 0 && selectedSubmissionIds.length === visibleSubmissions.length

  const rememberViewedSubmissions = useCallback((submissionIds: string[]) => {
    if (submissionIds.length === 0) return

    setViewedSubmissionIds((current) => {
      const next = new Set(current)
      submissionIds.forEach((id) => next.add(id))
      window.localStorage.setItem('topcloud:viewedSubmissionIds', JSON.stringify(Array.from(next)))
      return next
    })

    window.dispatchEvent(new Event('submission-counts-changed'))
  }, [])

  const loadSubmissions = useCallback(async (showRefreshState = false) => {
    setError('')
    setNotice('')
    setIsRefreshing(showRefreshState)

    if (!showRefreshState) {
      setIsLoading(true)
    }

    try {
      const result = await getFormSubmissions({
        page,
        pageSize,
        type,
        dateFilter,
        search,
      })

      setSubmissions(result.submissions)
      setCount(result.count)
      setSelectedSubmissionIds((currentIds) => currentIds.filter((id) => result.submissions.some((submission) => submission.id === id)))
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : String(fetchError)
      setSubmissions([])
      setCount(0)
      setError(message || `Unable to load ${type} submissions.`)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [dateFilter, page, search, type])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSubmissions(), 0)
    return () => window.clearTimeout(timer)
  }, [loadSubmissions])

  useEffect(() => {
    const channel = supabase
      ?.channel(`form-submissions-${type}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'form_submissions' }, () => {
        void loadSubmissions(true)
      })
      .subscribe()

    return () => {
      if (channel) {
        void supabase?.removeChannel(channel)
      }
    }
  }, [loadSubmissions, type])

  const updateSearch = (value: string) => {
    setPage(1)
    setSearch(value)
  }

  const updateDateFilter = (value: SubmissionDateFilter) => {
    setPage(1)
    setDateFilter(value)
  }

  const openSubmission = (submission: FormSubmission) => {
    setSelectedSubmission(submission)

    if (submission.status !== 'new' || viewedSubmissionIds.has(submission.id)) {
      return
    }

    async function markPageUnreadAsViewed() {
      try {
        const newItems = await getNewSubmissionBadgeItems()
        rememberViewedSubmissions(
          newItems
            .filter((item) => item.type === type)
            .map((item) => item.id),
        )
      } catch {
        rememberViewedSubmissions([submission.id])
      }
    }

    void markPageUnreadAsViewed()
  }

  const toggleSelectedSubmission = (submissionId: string) => {
    setSelectedSubmissionIds((currentIds) => (
      currentIds.includes(submissionId)
        ? currentIds.filter((id) => id !== submissionId)
        : [...currentIds, submissionId]
    ))
  }

  const toggleSelectAll = () => {
    setSelectedSubmissionIds(isAllSelected ? [] : visibleSubmissions.map((submission) => submission.id))
  }

  const confirmDelete = async () => {
    if (!submissionToDelete) return
    setIsDeleting(true)
    setNotice('')
    setError('')

    try {
      await deleteFormSubmission(submissionToDelete.id)
      setNotice(`Deleted ${submissionToDelete.full_name}'s submission.`)
      setSelectedSubmission((current) => (current?.id === submissionToDelete.id ? null : current))
      setSubmissionToDelete(null)
      window.dispatchEvent(new Event('submission-counts-changed'))
      await loadSubmissions(true)
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete this submission.')
    } finally {
      setIsDeleting(false)
    }
  }

  const confirmBulkDelete = async () => {
    if (selectedSubmissionIds.length === 0) return

    setIsDeleting(true)
    setNotice('')
    setError('')

    try {
      await deleteFormSubmissions(selectedSubmissionIds)
      setNotice(`Deleted ${selectedSubmissionIds.length} ${selectedSubmissionIds.length === 1 ? 'submission' : 'submissions'}.`)
      setSelectedSubmission((current) => (
        current && selectedSubmissionIds.includes(current.id) ? null : current
      ))
      setSubmissionToDelete(null)
      setIsBulkDeleteOpen(false)
      setSelectedSubmissionIds([])
      window.dispatchEvent(new Event('submission-counts-changed'))
      await loadSubmissions(true)
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete selected submissions.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title={title}
        description={description}
        action={
          <button
            type="button"
            onClick={() => void loadSubmissions(true)}
            disabled={isLoading || isRefreshing}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-admin-border bg-white px-4 text-sm font-semibold text-admin-dark shadow-sm transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      <section className="mb-5 rounded-2xl border border-admin-border bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
          <label className="relative block">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
            <input
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
              placeholder={`Search ${type === 'booking' ? 'bookings' : 'inquiries'} by name, email, phone, tour, or message`}
              className="h-11 w-full rounded-xl border border-admin-border bg-white pl-10 pr-3 text-sm text-admin-dark outline-none transition focus:border-admin-accent focus:ring-4 focus:ring-brand-100"
            />
          </label>
          <select
            value={dateFilter}
            onChange={(event) => updateDateFilter(event.target.value as SubmissionDateFilter)}
            className="h-11 rounded-xl border border-admin-border bg-white px-3 text-sm font-semibold text-admin-dark outline-none transition focus:border-admin-accent focus:ring-4 focus:ring-brand-100"
          >
            <option value="all">All dates</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <select
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value as SortMode)}
            className="h-11 rounded-xl border border-admin-border bg-white px-3 text-sm font-semibold text-admin-dark outline-none transition focus:border-admin-accent focus:ring-4 focus:ring-brand-100"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="status">New first</option>
          </select>
          <div className="inline-flex h-11 items-center justify-center rounded-xl border border-brand-100 bg-brand-50 px-4 text-sm font-semibold text-brand-800">
            {newCount} new
          </div>
        </div>
      </section>

      {!isLoading && visibleSubmissions.length > 0 ? (
        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-admin-border bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <label className="inline-flex items-center gap-3 text-sm font-semibold text-admin-dark">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
            />
            Select all
            {hasSelection ? <span className="text-admin-muted">({selectedSubmissionIds.length} selected)</span> : null}
          </label>
          <button
            type="button"
            onClick={() => {
              setIsBulkDeleteOpen(true)
              setError('')
              setNotice('')
            }}
            disabled={!hasSelection || isDeleting}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
            Delete Selected
          </button>
        </section>
      ) : null}

      {notice ? (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {notice}
        </div>
      ) : null}

      {error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-red-800">Could not load submissions</h2>
          <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
        </section>
      ) : isLoading ? (
        <LoadingTable />
      ) : visibleSubmissions.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-2xl border border-admin-border bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-[1120px] w-full table-fixed divide-y divide-admin-border">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[9%]" />
                  <col className="w-[14%]" />
                  <col className="w-[18%]" />
                  <col className="w-[13%]" />
                  <col className="w-[20%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                        aria-label={`Select all ${type === 'booking' ? 'bookings' : 'inquiries'}`}
                      />
                    </th>
                    {['Type', 'Name', 'Email', 'Contact', 'Tour / Preview', 'Status', 'Date Submitted', 'Actions'].map((heading) => (
                      <th key={heading} className="px-5 py-4 text-left text-[0.7rem] font-bold uppercase tracking-wide text-admin-muted">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-admin-border bg-white">
                  {visibleSubmissions.map((submission) => (
                    <tr
                      key={submission.id}
                      className={`cursor-pointer transition hover:bg-brand-50/40 ${submission.status === 'new' && !viewedSubmissionIds.has(submission.id) ? 'bg-brand-50/20' : ''}`}
                      onClick={() => openSubmission(submission)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openSubmission(submission)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="px-5 py-4">
                        <input
                          type="checkbox"
                          checked={selectedSubmissionIds.includes(submission.id)}
                          onChange={(event) => {
                            event.stopPropagation()
                            toggleSelectedSubmission(submission.id)
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                          aria-label={`Select ${submission.full_name}'s submission`}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${typeClasses(submission.type)}`}>
                          {formatType(submission.type)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="truncate text-sm font-bold text-admin-dark">{submission.full_name}</p>
                      </td>
                      <td className="px-5 py-4">
                        <a
                          className="block truncate text-sm font-semibold text-admin-dark hover:text-admin-accent"
                          href={`mailto:${submission.email}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {submission.email}
                        </a>
                      </td>
                      <td className="px-5 py-4">
                        <a
                          className="block truncate text-sm text-admin-muted hover:text-admin-accent"
                          href={`tel:${submission.phone}`}
                          onClick={(event) => event.stopPropagation()}
                        >
                          {submission.phone}
                        </a>
                      </td>
                      <td className="px-5 py-4">
                        <p className="truncate text-sm font-semibold text-admin-dark">{getPackageName(submission)}</p>
                        <p className="mt-1 line-clamp-1 text-xs leading-5 text-admin-muted">{getPreview(submission)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${readStatusClasses(getReadStatus(submission, viewedSubmissionIds) === 'New')}`}>
                          {getReadStatus(submission, viewedSubmissionIds)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-admin-muted">{formatDate(submission.created_at)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openSubmission(submission)
                            }}
                            className="grid h-9 w-9 place-items-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent"
                            aria-label={`View ${submission.full_name}'s submission`}
                          >
                            <FiEye />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSubmissionToDelete(submission)
                            }}
                            className="grid h-9 w-9 place-items-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                            aria-label={`Delete ${submission.full_name}'s submission`}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:hidden">
            {visibleSubmissions.map((submission) => (
              <article
                key={submission.id}
                className={`rounded-2xl border border-admin-border bg-white p-4 shadow-sm ${submission.status === 'new' && !viewedSubmissionIds.has(submission.id) ? 'ring-1 ring-brand-100' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <input
                      type="checkbox"
                      checked={selectedSubmissionIds.includes(submission.id)}
                      onChange={() => toggleSelectedSubmission(submission.id)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                      aria-label={`Select ${submission.full_name}'s submission`}
                    />
                    <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${typeClasses(submission.type)}`}>
                        {formatType(submission.type)}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${readStatusClasses(getReadStatus(submission, viewedSubmissionIds) === 'New')}`}>
                        {getReadStatus(submission, viewedSubmissionIds)}
                      </span>
                    </div>
                    <h2 className="mt-3 truncate text-base font-bold text-admin-dark">{submission.full_name}</h2>
                    <p className="truncate text-sm text-admin-muted">{submission.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openSubmission(submission)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent"
                    aria-label={`View ${submission.full_name}'s submission`}
                  >
                    <FiEye />
                  </button>
                </div>
                <p className="mt-3 text-sm font-semibold text-admin-dark">{getPackageName(submission)}</p>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-admin-muted">{getPreview(submission)}</p>
                <div className="mt-4 flex items-center justify-between border-t border-admin-border pt-4 text-xs font-semibold text-admin-muted">
                  <span>{formatDate(submission.created_at)}</span>
                  <button type="button" className="text-red-600" onClick={() => setSubmissionToDelete(submission)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-admin-muted">
              Page {page} of {totalPages} · {count} {count === 1 ? 'submission' : 'submissions'}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="h-10 rounded-lg border border-admin-border bg-white px-4 text-sm font-semibold text-admin-dark transition hover:border-admin-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="h-10 rounded-lg border border-admin-border bg-white px-4 text-sm font-semibold text-admin-dark transition hover:border-admin-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      {selectedSubmission ? (
        <SubmissionModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onDelete={() => setSubmissionToDelete(selectedSubmission)}
        />
      ) : null}

      {submissionToDelete ? (
        <DeleteModal
          submission={submissionToDelete}
          isDeleting={isDeleting}
          onCancel={() => setSubmissionToDelete(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}

      {isBulkDeleteOpen ? (
        <BulkDeleteModal
          submissions={selectedSubmissions}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setIsBulkDeleteOpen(false)
            }
          }}
          onConfirm={() => void confirmBulkDelete()}
        />
      ) : null}
    </div>
  )
}

function BulkDeleteModal({
  submissions,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  submissions: FormSubmission[]
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-[modal-enter_180ms_ease-out] rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <FiAlertTriangle />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-admin-dark">Delete selected submissions?</h2>
            <div className="mt-2 max-h-36 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
              {submissions.map((submission) => (
                <p key={submission.id} className="truncate">
                  {submission.full_name}
                </p>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-admin-muted">
              This permanently removes these records from the dashboard. Email notifications that were already sent are not affected.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiTrash2 />
            {isDeleting ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LoadingTable() {
  return (
    <section className="rounded-2xl border border-admin-border bg-white p-6 shadow-sm">
      <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
      <div className="mt-5 space-y-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    </section>
  )
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-admin-border bg-slate-50 px-4 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-admin-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-admin-dark">{value || 'Not provided'}</dd>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold uppercase tracking-wide text-admin-dark">{children}</h3>
}

function SubmissionModal({
  submission,
  onClose,
  onDelete,
}: {
  submission: FormSubmission
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm">
      <div className="flex h-screen w-screen animate-[modal-enter_180ms_ease-out] flex-col bg-white">
        <div className="border-b border-admin-border bg-white/95 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-7xl items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${typeClasses(submission.type)}`}>
                  {formatType(submission.type)}
                </span>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClasses(submission.status)}`}>
                  {submission.status}
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-bold text-admin-dark">{submission.full_name}</h2>
              <p className="mt-1 text-sm text-admin-muted">{formatDate(submission.created_at)}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent"
              aria-label="Close submission details"
            >
              <FiX />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-7xl space-y-6">
            <section className="rounded-2xl border border-admin-border bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle>Contact</SectionTitle>
              <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <DetailItem label="Full Name" value={submission.full_name} />
                <DetailItem label="Email" value={<a href={`mailto:${submission.email}`}>{submission.email}</a>} />
                <DetailItem label="Phone / WhatsApp" value={<a href={`tel:${submission.phone}`}>{submission.phone}</a>} />
                <DetailItem label="Country" value={submission.country} />
              </dl>
            </section>

            <section className="rounded-2xl border border-admin-border bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle>{submission.type === 'booking' ? 'Booking Details' : 'Inquiry Details'}</SectionTitle>
              <dl className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <DetailItem label="Tour Package" value={getPackageName(submission)} />
                <DetailItem label="Preferred Travel Date" value={submission.preferred_travel_date || 'Not provided'} />
                <DetailItem label="Flexible Dates" value={submission.date_flexible === null ? 'Not provided' : submission.date_flexible ? 'Yes' : 'No'} />
                <DetailItem label="Adults" value={submission.adults} />
                <DetailItem label="Children" value={submission.children} />
                <DetailItem label="Children Ages" value={submission.children_ages} />
                <DetailItem label="Accommodation" value={submission.accommodation_preference} />
                <DetailItem label="Budget Per Person" value={submission.budget_per_person} />
                <DetailItem label="Estimated Group Budget" value={submission.estimated_group_budget || submission.estimated_budget} />
                <DetailItem label="Currency" value={submission.currency} />
              </dl>
            </section>

            <section className="rounded-2xl border border-admin-border bg-white p-5 shadow-sm sm:p-6">
              <SectionTitle>Notes</SectionTitle>
              <dl className="mt-4 grid gap-3">
                <DetailItem label="Message" value={<p className="whitespace-pre-wrap">{submission.message}</p>} />
                <DetailItem label="Special Notes" value={<p className="whitespace-pre-wrap">{submission.special_requests}</p>} />
              </dl>
            </section>
          </div>
        </div>

        <div className="border-t border-admin-border bg-white px-4 py-4 sm:px-8">
          <div className="mx-auto flex max-w-7xl flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <FiTrash2 /> Delete
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-admin-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DeleteModal({
  submission,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  submission: FormSubmission
  isDeleting: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg animate-[modal-enter_180ms_ease-out] rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
            <FiAlertTriangle />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-admin-dark">Delete this submission?</h2>
            <p className="mt-2 text-sm font-semibold text-slate-900">{submission.full_name}</p>
            <p className="mt-3 text-sm leading-6 text-admin-muted">
              This permanently removes the record from the dashboard. Email notifications that were already sent are not affected.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiTrash2 />
            {isDeleting ? 'Deleting...' : 'Delete Submission'}
          </button>
        </div>
      </div>
    </div>
  )
}
