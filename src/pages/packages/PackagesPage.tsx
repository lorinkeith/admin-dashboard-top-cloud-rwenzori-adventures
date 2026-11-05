import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiArrowDown,
  FiArrowUp,
  FiCopy,
  FiImage,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi'
import EmptyState from '../../components/ui/EmptyState'
import PageHeader from '../../components/ui/PageHeader'
import { deleteTourPackage, duplicateTourPackage, getPackages, updatePackagesOrder, updateTourPackageStatuses } from '../../services/packageService'
import type { PackageStatus, TourPackage } from '../../types/tourPackage'

type DropTarget = {
  packageId: string
  position: 'before' | 'after'
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  style: 'currency',
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const statusStyles: Record<PackageStatus, string> = {
  archived: 'border-red-200 bg-red-50 text-red-700',
  draft: 'border-amber-200 bg-amber-50 text-amber-700',
  published: 'border-emerald-200 bg-emerald-50 text-emerald-700',
}

function formatStatus(status: PackageStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function formatDuration(days: number) {
  return `${days} ${days === 1 ? 'Day' : 'Days'}`
}

function getStatusStyle(status: PackageStatus) {
  return statusStyles[status] ?? statusStyles.draft
}

function formatPrice(price: number | null) {
  return price === null ? 'No price' : currencyFormatter.format(Number(price || 0))
}

function formatCreatedDate(createdAt: string) {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return 'Unknown'
  }

  return dateFormatter.format(date)
}

function openPackageEditor(navigate: ReturnType<typeof useNavigate>, packageId: string) {
  navigate(`/packages/${packageId}/edit`)
}

function normalizePackageOrder(packages: TourPackage[]) {
  return packages.map((tourPackage, index) => ({
    ...tourPackage,
    display_order: index + 1,
  }))
}

function hasPackageOrderChanged(
  previousPackages: TourPackage[],
  nextPackages: TourPackage[],
) {
  return previousPackages.some((tourPackage, index) => tourPackage.id !== nextPackages[index]?.id)
}

function getDuplicateInfo(title: string) {
  const match = title.match(/^(.*?)\s+(?:copy|duplicate)-?(\d+)?$/i)

  if (!match) return null

  return {
    baseTitle: match[1].trim(),
    label: `Duplicate #${match[2] ?? '1'}`,
  }
}

function PackagesPage() {
  const navigate = useNavigate()
  const [packages, setPackages] = useState<TourPackage[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [packageToDelete, setPackageToDelete] = useState<TourPackage | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteSuccess, setDeleteSuccess] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [duplicatingPackageId, setDuplicatingPackageId] = useState<string | null>(null)
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([])
  const [isBulkDuplicating, setIsBulkDuplicating] = useState(false)
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false)
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [draggedPackageId, setDraggedPackageId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const packagesRef = useRef<TourPackage[]>([])
  const dragStartPackagesRef = useRef<TourPackage[]>([])
  const draggedPackageIdRef = useRef<string | null>(null)
  const dropTargetRef = useRef<DropTarget | null>(null)
  const didHandleDropRef = useRef(false)
  const suppressNextClickRef = useRef(false)
  const lastSelectedPackageIdRef = useRef<string | null>(null)

  const selectedPackages = packages.filter((tourPackage) => selectedPackageIds.includes(tourPackage.id))
  const isAllSelected = packages.length > 0 && selectedPackageIds.length === packages.length
  const hasSelection = selectedPackageIds.length > 0

  useEffect(() => {
    packagesRef.current = packages
  }, [packages])

  const loadPackages = useCallback(async (showRefreshState = false) => {
    setError('')
    setIsRefreshing(showRefreshState)

    if (!showRefreshState) {
      setIsLoading(true)
    }

    try {
      const packageData = await getPackages()
      setPackages(normalizePackageOrder(packageData))
      setSelectedPackageIds((currentIds) => currentIds.filter((id) => packageData.some((tourPackage) => tourPackage.id === id)))
      console.log('Tour packages saved to state:', packageData.length)
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : String(fetchError)

      setPackages([])
      setError(
        message ||
          'Unable to load tour packages from Supabase. Please try again.',
      )
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPackages(), 0)
    return () => window.clearTimeout(timer)
  }, [loadPackages])

  const openDeleteModal = (tourPackage: TourPackage) => {
    setPackageToDelete(tourPackage)
    setSelectedPackageIds([])
    setDeleteError('')
  }

  const closeDeleteModal = () => {
    if (isDeleting) return
    setPackageToDelete(null)
    setIsBulkDeleteOpen(false)
    setDeleteError('')
  }

  const toggleSelectedPackage = (packageId: string, shiftKey = false) => {
    setSelectedPackageIds((currentIds) => {
      if (shiftKey && lastSelectedPackageIdRef.current) {
        const startIndex = packages.findIndex((tourPackage) => tourPackage.id === lastSelectedPackageIdRef.current)
        const endIndex = packages.findIndex((tourPackage) => tourPackage.id === packageId)

        if (startIndex >= 0 && endIndex >= 0) {
          const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
          const rangeIds = packages.slice(from, to + 1).map((tourPackage) => tourPackage.id)
          return Array.from(new Set([...currentIds, ...rangeIds]))
        }
      }

      return currentIds.includes(packageId)
        ? currentIds.filter((id) => id !== packageId)
        : [...currentIds, packageId]
    })
    lastSelectedPackageIdRef.current = packageId
  }

  const toggleSelectAll = () => {
    setSelectedPackageIds(isAllSelected ? [] : packages.map((tourPackage) => tourPackage.id))
    lastSelectedPackageIdRef.current = null
  }

  const handleConfirmDelete = async () => {
    const packagesToDelete = packageToDelete ? [packageToDelete] : selectedPackages
    if (packagesToDelete.length === 0) return

    setIsDeleting(true)
    setDeleteError('')
    setDeleteSuccess('')

    try {
      await Promise.all(packagesToDelete.map((tourPackage) => deleteTourPackage(tourPackage.id)))
      setDeleteSuccess(
        packagesToDelete.length === 1
          ? `Deleted "${packagesToDelete[0].title}".`
          : `Deleted ${packagesToDelete.length} packages.`,
      )
      setPackageToDelete(null)
      setIsBulkDeleteOpen(false)
      setSelectedPackageIds([])
      await loadPackages(true)
    } catch (deleteFailure) {
      const message =
        deleteFailure instanceof Error
          ? deleteFailure.message
          : String(deleteFailure)

      setDeleteError(
        message || 'Unable to delete this package. Please try again.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDuplicate = async () => {
    if (selectedPackages.length === 0) return

    setIsBulkDuplicating(true)
    setDeleteSuccess('')
    setDeleteError('')
    setError('')

    try {
      for (const tourPackage of selectedPackages) {
        await duplicateTourPackage(tourPackage.id)
      }

      setDeleteSuccess(`Duplicated ${selectedPackages.length} package${selectedPackages.length === 1 ? '' : 's'}.`)
      setSelectedPackageIds([])
      await loadPackages(true)
    } catch (duplicateError) {
      const message = duplicateError instanceof Error ? duplicateError.message : String(duplicateError)
      setError(message || 'Unable to duplicate selected packages. Please try again.')
    } finally {
      setIsBulkDuplicating(false)
    }
  }

  const handleBulkStatusChange = async (status: PackageStatus) => {
    if (selectedPackageIds.length === 0) return

    setIsBulkUpdatingStatus(true)
    setDeleteSuccess('')
    setError('')

    try {
      await updateTourPackageStatuses(selectedPackageIds, status)
      setDeleteSuccess(`Updated ${selectedPackageIds.length} package${selectedPackageIds.length === 1 ? '' : 's'} to ${formatStatus(status)}.`)
      await loadPackages(true)
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : String(statusError)
      setError(message || 'Unable to update selected package statuses. Please try again.')
    } finally {
      setIsBulkUpdatingStatus(false)
    }
  }

  const savePackageOrder = async (
    orderedPackages: TourPackage[],
    previousPackages: TourPackage[],
  ) => {
    const normalizedPackages = normalizePackageOrder(orderedPackages)

    setPackages(normalizedPackages)
    setError('')
    setDeleteError('')
    setDeleteSuccess('')
    setIsSavingOrder(true)

    try {
      await updatePackagesOrder(
        normalizedPackages.map(({ id, display_order }) => ({
          id,
          display_order,
        })),
      )
      setDeleteSuccess('Order updated.')
    } catch (orderError) {
      const message = orderError instanceof Error ? orderError.message : String(orderError)
      setPackages(previousPackages)
      setError(message || 'Could not save the package order. The previous order was restored.')
      void loadPackages(true)
    } finally {
      setIsSavingOrder(false)
      setDraggedPackageId(null)
    }
  }

  const startPackageDrag = (packageId: string) => {
    if (isSavingOrder) return

    dragStartPackagesRef.current = packagesRef.current
    draggedPackageIdRef.current = packageId
    dropTargetRef.current = null
    didHandleDropRef.current = false
    suppressNextClickRef.current = false
    setDraggedPackageId(packageId)
    setDropTarget(null)
    setError('')
    setDeleteSuccess('')
  }

  const updatePackageDropTarget = (
    event: {
      clientY: number
      currentTarget: HTMLElement
    },
    packageId: string,
  ) => {
    const currentDraggedPackageId = draggedPackageIdRef.current

    if (!currentDraggedPackageId || currentDraggedPackageId === packageId || isSavingOrder) {
      dropTargetRef.current = null
      setDropTarget(null)
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const position: DropTarget['position'] = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'

    const nextTarget = { packageId, position }
    dropTargetRef.current = nextTarget
    setDropTarget((currentTarget) =>
      currentTarget?.packageId === nextTarget.packageId && currentTarget.position === nextTarget.position
        ? currentTarget
        : nextTarget,
    )
  }

  const getOrderedPackagesForDrop = () => {
    const currentDraggedPackageId = draggedPackageIdRef.current
    const currentDropTarget = dropTargetRef.current

    if (!currentDraggedPackageId || !currentDropTarget) {
      return packagesRef.current
    }

    const currentPackages = packagesRef.current
    const draggedPackage = currentPackages.find((tourPackage) => tourPackage.id === currentDraggedPackageId)

    if (!draggedPackage) {
      return currentPackages
    }

    const packagesWithoutDragged = currentPackages.filter((tourPackage) => tourPackage.id !== currentDraggedPackageId)
    const targetIndex = packagesWithoutDragged.findIndex((tourPackage) => tourPackage.id === currentDropTarget.packageId)

    if (targetIndex < 0) {
      return currentPackages
    }

    const insertIndex = currentDropTarget.position === 'before' ? targetIndex : targetIndex + 1
    const nextPackages = [...packagesWithoutDragged]
    nextPackages.splice(insertIndex, 0, draggedPackage)

    return normalizePackageOrder(nextPackages)
  }

  const finishPackageDrag = (isDrop = false) => {
    if (didHandleDropRef.current && !isDrop) {
      didHandleDropRef.current = false
      return
    }

    if (!draggedPackageIdRef.current) return

    const nextPackages = getOrderedPackagesForDrop()
    const previousPackages = dragStartPackagesRef.current
    draggedPackageIdRef.current = null
    dropTargetRef.current = null
    didHandleDropRef.current = isDrop
    setDraggedPackageId(null)
    setDropTarget(null)

    if (hasPackageOrderChanged(previousPackages, nextPackages)) {
      suppressNextClickRef.current = true
      void savePackageOrder(nextPackages, previousPackages)
    }

    window.setTimeout(() => {
      suppressNextClickRef.current = false
    }, 0)
  }

  const movePackage = (packageId: string, direction: -1 | 1) => {
    if (isSavingOrder) return

    const currentIndex = packages.findIndex((tourPackage) => tourPackage.id === packageId)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= packages.length) {
      return
    }

    const nextPackages = [...packages]
    const [movedPackage] = nextPackages.splice(currentIndex, 1)
    nextPackages.splice(targetIndex, 0, movedPackage)
    void savePackageOrder(nextPackages, packages)
  }

  const handleDuplicatePackage = async (tourPackage: TourPackage) => {
    setDuplicatingPackageId(tourPackage.id)
    setDeleteSuccess('')
    setDeleteError('')
    setError('')

    try {
      const duplicatedPackage = await duplicateTourPackage(tourPackage.id)

      navigate(`/packages/${duplicatedPackage.id}/edit`, {
        state: {
          initialSection: 'basic',
          successMessage: `Duplicated "${tourPackage.title}" as "${duplicatedPackage.title}".`,
        },
      })
    } catch (duplicateError) {
      const message = duplicateError instanceof Error ? duplicateError.message : String(duplicateError)
      setError(message || 'Unable to duplicate this package. Please try again.')
    } finally {
      setDuplicatingPackageId(null)
    }
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      <PageHeader
        title="Tour Packages"
        description="Create and organize tour packages before publishing them to the public website."
        action={
          // Mobile controls stay in one balanced row: icon-only refresh and a wider primary create action.
          <div className="grid w-full min-w-0 grid-cols-[3rem_minmax(0,1fr)] items-center gap-3 sm:w-auto sm:grid-cols-[3rem_auto]">
            <button
              type="button"
              onClick={() => void loadPackages(true)}
              disabled={isLoading || isRefreshing}
              className="inline-flex h-11 w-12 items-center justify-center rounded-xl border border-admin-border bg-white text-admin-dark shadow-sm transition hover:border-admin-accent hover:text-admin-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Refresh packages"
              title="Refresh packages"
            >
              <FiRefreshCw
                className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
            <Link
              to="/packages/new"
              className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl bg-[#007A24] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007A24] hover:opacity-90 sm:min-w-44"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" />
              Add New Package
            </Link>
          </div>
        }
      />

      {deleteSuccess ? (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {deleteSuccess}
        </div>
      ) : null}

      {isLoading ? (
        <section className="rounded-lg border border-admin-border bg-white p-6 shadow-sm">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 space-y-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-16 animate-pulse rounded-lg bg-slate-100"
              />
            ))}
          </div>
        </section>
      ) : error ? (
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <h2 className="text-base font-semibold text-red-800">
            Could not load packages
          </h2>
          <p className="mt-2 text-sm leading-6 text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => void loadPackages(true)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </button>
        </section>
      ) : packages.length === 0 ? (
        <EmptyState
          title="No packages yet"
          description="Create your first tour package to start building the Top Cloud Rwenzori Adventures catalog."
          action={
            <Link
              to="/packages/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-admin-border bg-white px-4 py-2.5 text-sm font-semibold text-admin-dark transition hover:border-admin-accent hover:text-admin-accent"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" />
              Create your first tour package
            </Link>
          }
        />
      ) : (
        <>
          <section className="mb-5 rounded-2xl border border-admin-border bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <label className="inline-flex min-h-10 min-w-0 items-center gap-3 text-sm font-semibold text-admin-dark">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                />
                <span>Select all</span>
                {hasSelection ? (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.68rem] font-bold text-[#007A24]">
                    {selectedPackageIds.length}
                  </span>
                ) : null}
              </label>

              <div className="flex flex-wrap items-center gap-2">
                {isSavingOrder ? (
                  <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 text-sm font-semibold text-brand-700">
                    <FiRefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving order
                  </span>
                ) : null}
                <select
                  value=""
                  onChange={(event) => {
                    const nextStatus = event.target.value as PackageStatus
                    if (nextStatus) void handleBulkStatusChange(nextStatus)
                    event.currentTarget.value = ''
                  }}
                  disabled={!hasSelection || isBulkUpdatingStatus || isDeleting}
                  className="h-10 min-w-36 rounded-xl border border-admin-border bg-white px-3 text-sm font-semibold text-admin-dark shadow-sm outline-none transition hover:border-admin-accent focus:border-admin-accent focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Update selected package status"
                >
                  <option value="">{isBulkUpdatingStatus ? 'Updating...' : 'Set status'}</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <button
                  type="button"
                  onClick={() => void handleBulkDuplicate()}
                  disabled={!hasSelection || isBulkDuplicating || isDeleting || isBulkUpdatingStatus}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-admin-border bg-white px-3 text-sm font-semibold text-admin-dark shadow-sm transition hover:border-admin-accent hover:text-admin-accent hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Duplicate selected packages"
                  title="Duplicate selected packages"
                >
                  <FiCopy className="h-4 w-4" aria-hidden="true" />
                  {isBulkDuplicating ? 'Duplicating...' : 'Duplicate selected'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPackageToDelete(null)
                    setIsBulkDeleteOpen(true)
                    setDeleteError('')
                  }}
                  disabled={!hasSelection || isBulkDuplicating || isDeleting || isBulkUpdatingStatus}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 shadow-sm transition hover:bg-red-50 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Delete selected packages"
                  title="Delete selected packages"
                >
                  <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                  Delete selected
                </button>
              </div>
            </div>
          </section>

          <section className="hidden overflow-hidden rounded-lg border border-admin-border bg-white shadow-sm lg:block">
            <table className="w-full table-fixed divide-y divide-admin-border">
              <colgroup>
                <col className="w-[4%]" />
                <col className="w-[29%]" />
                <col className="w-[13%]" />
                <col className="w-[12%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[15%]" />
              </colgroup>
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                      aria-label="Select all packages"
                    />
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-admin-muted">
                    Package
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-admin-muted">
                    Category
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-admin-muted">
                    Price
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-admin-muted">
                    Duration
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-admin-muted">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-admin-muted">
                    Created
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-admin-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border bg-white">
                {packages.map((tourPackage) => {
                  const duplicateInfo = getDuplicateInfo(tourPackage.title)
                  const isDragging = draggedPackageId === tourPackage.id
                  const isDropTarget = dropTarget?.packageId === tourPackage.id

                  return (
                  <tr
                    key={tourPackage.id}
                    draggable={!isSavingOrder}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', tourPackage.id)
                      startPackageDrag(tourPackage.id)
                    }}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      updatePackageDropTarget(event, tourPackage.id)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      finishPackageDrag(true)
                    }}
                    onDragEnd={() => finishPackageDrag(false)}
                    className={`cursor-grab transition-all duration-200 hover:bg-slate-50 active:cursor-grabbing ${duplicateInfo ? 'bg-brand-50/35' : ''} ${isDragging ? 'scale-[0.995] cursor-grabbing bg-brand-50 opacity-75 shadow-lg ring-2 ring-brand-200' : ''} ${isDropTarget ? dropTarget.position === 'before' ? 'border-t-2 border-t-admin-accent' : 'border-b-2 border-b-admin-accent' : ''}`}
                    onClick={() => {
                      if (suppressNextClickRef.current) return
                      openPackageEditor(navigate, tourPackage.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openPackageEditor(navigate, tourPackage.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Edit ${tourPackage.title}`}
                    aria-grabbed={isDragging}
                  >
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPackageIds.includes(tourPackage.id)}
                        onChange={(event) => {
                          event.stopPropagation()
                          toggleSelectedPackage(tourPackage.id, (event.nativeEvent as MouseEvent).shiftKey)
                        }}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                        aria-label={`Select ${tourPackage.title}`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="flex h-[68px] w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-admin-border bg-slate-100">
                          {tourPackage.main_image_url ? (
                            <img
                              src={tourPackage.main_image_url}
                              alt=""
                              className="block h-full w-full object-cover"
                            />
                          ) : (
                            <FiImage
                              className="h-5 w-5 text-admin-muted"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <h2 className="min-w-0 truncate text-sm font-semibold text-admin-dark">
                              {duplicateInfo?.baseTitle ?? tourPackage.title}
                            </h2>
                            {duplicateInfo ? (
                              <span className="shrink-0 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-brand-700">
                                {duplicateInfo.label}
                              </span>
                            ) : null}
                          </div>
                          {duplicateInfo ? (
                            <p className="mt-1 truncate text-xs font-medium text-brand-700">
                              Duplicate package
                            </p>
                          ) : null}
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-admin-muted">
                            {tourPackage.short_description ||
                              `/${tourPackage.slug}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="truncate px-5 py-4 text-sm text-admin-muted">
                      {tourPackage.category}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-medium text-admin-dark">
                      {formatPrice(tourPackage.price_from_usd)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-admin-muted">
                      {formatDuration(tourPackage.duration_days)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusStyle(tourPackage.status)}`}
                      >
                        {formatStatus(tourPackage.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-sm text-admin-muted">
                      {formatCreatedDate(tourPackage.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDuplicatePackage(tourPackage)
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          disabled={duplicatingPackageId === tourPackage.id}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white text-sm font-semibold text-admin-dark transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-60"
                          title="Duplicate package"
                          aria-label={`Duplicate ${tourPackage.title}`}
                        >
                          <FiCopy className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">
                            {duplicatingPackageId === tourPackage.id ? 'Duplicating...' : 'Duplicate'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            openDeleteModal(tourPackage)
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                          title="Delete package"
                          aria-label={`Delete ${tourPackage.title}`}
                        >
                          <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="-mx-4 flex max-w-[calc(100%+2rem)] snap-x gap-3 overflow-x-auto px-4 pb-3 lg:hidden">
            {packages.map((tourPackage) => {
              const duplicateInfo = getDuplicateInfo(tourPackage.title)

              return (
              <article
                key={tourPackage.id}
                className={`relative w-[82vw] min-w-[16.75rem] max-w-[20rem] shrink-0 snap-start cursor-pointer overflow-hidden rounded-xl border shadow-sm transition hover:border-admin-accent hover:bg-slate-50 ${duplicateInfo ? 'border-brand-200 bg-brand-50/35' : 'border-admin-border bg-white'}`}
                onClick={() => openPackageEditor(navigate, tourPackage.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openPackageEditor(navigate, tourPackage.id)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Edit ${tourPackage.title}`}
              >
                <div className="absolute left-3 top-3 z-10 rounded-full bg-white/90 p-2 shadow-sm">
                  <input
                    type="checkbox"
                    checked={selectedPackageIds.includes(tourPackage.id)}
                    onChange={(event) => {
                      event.stopPropagation()
                      toggleSelectedPackage(tourPackage.id, (event.nativeEvent as MouseEvent).shiftKey)
                    }}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                    className="h-4 w-4 rounded border-admin-border text-admin-accent focus:ring-admin-accent"
                    aria-label={`Select ${tourPackage.title}`}
                  />
                </div>
                <div className="h-36 w-full bg-slate-100">
                  {tourPackage.main_image_url ? (
                    <img
                      src={tourPackage.main_image_url}
                      alt=""
                      className="block h-full w-full object-cover object-center"
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <FiImage
                        className="h-7 w-7 text-admin-muted"
                        aria-hidden="true"
                      />
                    </div>
                  )}
                </div>

                <div className="min-w-0 p-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-sm font-bold text-admin-dark">
                        {duplicateInfo?.baseTitle ?? tourPackage.title}
                      </h2>
                      {duplicateInfo ? (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-brand-700">
                            {duplicateInfo.label}
                          </span>
                        </div>
                      ) : null}
                      <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-admin-muted">
                        {tourPackage.short_description || `/${tourPackage.slug}`}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${getStatusStyle(tourPackage.status)}`}
                    >
                      {formatStatus(tourPackage.status)}
                    </span>
                  </div>

                  <dl className="mt-3 grid min-w-0 grid-cols-2 gap-2 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase text-admin-muted">
                        Category
                      </dt>
                      <dd className="mt-1 truncate font-medium text-admin-dark">
                        {tourPackage.category}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase text-admin-muted">
                        Price
                      </dt>
                      <dd className="mt-1 truncate font-medium text-admin-dark">
                        {formatPrice(tourPackage.price_from_usd)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase text-admin-muted">
                        Duration
                      </dt>
                      <dd className="mt-1 truncate font-medium text-admin-dark">
                        {formatDuration(tourPackage.duration_days)}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase text-admin-muted">
                        Created
                      </dt>
                      <dd className="mt-1 truncate font-medium text-admin-dark">
                        {formatCreatedDate(tourPackage.created_at)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-3 flex justify-end gap-1.5 border-t border-admin-border pt-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        movePackage(tourPackage.id, -1)
                      }}
                      disabled={isSavingOrder || packages[0]?.id === tourPackage.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-40"
                      title="Move up"
                      aria-label={`Move ${tourPackage.title} up`}
                    >
                      <FiArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        movePackage(tourPackage.id, 1)
                      }}
                      disabled={isSavingOrder || packages[packages.length - 1]?.id === tourPackage.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-40"
                      title="Move down"
                      aria-label={`Move ${tourPackage.title} down`}
                    >
                      <FiArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDuplicatePackage(tourPackage)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      disabled={duplicatingPackageId === tourPackage.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-dark transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-60"
                      title="Duplicate package"
                      aria-label={`Duplicate ${tourPackage.title}`}
                    >
                      <FiCopy className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">
                        {duplicatingPackageId === tourPackage.id ? 'Duplicating...' : 'Duplicate'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        openDeleteModal(tourPackage)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                      title="Delete package"
                      aria-label={`Delete ${tourPackage.title}`}
                    >
                      <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Delete</span>
                    </button>
                  </div>
                </div>
              </article>
              )
            })}
          </section>
        </>
      )}
      {(packageToDelete || isBulkDeleteOpen) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
                <FiAlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-admin-dark">
                  {packageToDelete ? 'Delete this package?' : `Delete ${selectedPackages.length} packages?`}
                </h2>
                {packageToDelete ? (
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {packageToDelete.title}
                  </p>
                ) : (
                  <div className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                    {selectedPackages.map((tourPackage) => (
                      <p key={tourPackage.id} className="truncate">{tourPackage.title}</p>
                    ))}
                  </div>
                )}
                <p className="mt-3 text-sm leading-6 text-admin-muted">
                  This action will permanently delete {packageToDelete ? 'this package' : 'the selected packages'}, related database content, and the main/hero images attached to {packageToDelete ? 'this package' : 'them'}.
                </p>

                {deleteError ? (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {deleteError}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={isDeleting}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                {isDeleting ? 'Deleting...' : 'Delete Package'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default PackagesPage


