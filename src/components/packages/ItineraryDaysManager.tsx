import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  FiArrowDown,
  FiArrowUp,
  FiCalendar,
  FiCheckCircle,
  FiChevronDown,
  FiEdit2,
  FiPlus,
  FiSave,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import {
  createItineraryActivity,
  createItineraryDay,
  deleteItineraryActivity,
  deleteItineraryDay,
  getActivitiesForPackageDays,
  getImagesForPackageDays,
  getPackageItineraryDays,
  updateItineraryActivity,
  updateItineraryDay,
  updateItineraryDaysOrder,
} from '../../services/packageService'
import type {
  TourItineraryActivity,
  TourItineraryDay,
  TourItineraryImage,
} from '../../types/tourPackage'
import ItineraryDayImagesManager from './ItineraryDayImagesManager'

type ItineraryDaysManagerProps = {
  packageId: string
  onDaysCountChange?: (count: number) => void
}

type DayFormState = {
  day_number: string
  title: string
  overview: string
  accommodation_name: string
}

type ActivitiesByDay = Record<string, TourItineraryActivity[]>
type ImageCountsByDay = Record<string, number>

type ActivityFormState = {
  title: string
  description: string
}

type DropTarget = {
  dayId: string
  position: 'before' | 'after'
}

const emptyFormState: DayFormState = {
  day_number: '',
  title: '',
  overview: '',
  accommodation_name: '',
}

const activityPlaceholders = [
  'Airport pickup and transfer',
  'Scenic drive to your lodge',
  'Lodge check-in and orientation',
  'Guided wildlife tracking',
  'Evening transfer and lodge check-in',
]

const inputClassName =
  'h-11 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

const textareaClassName =
  'min-h-[110px] w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 resize-y whitespace-pre-wrap break-words'

function toFormState(day: TourItineraryDay): DayFormState {
  return {
    day_number: String(day.day_number),
    title: day.title,
    overview: day.overview ?? '',
    accommodation_name: day.accommodation_name ?? '',
  }
}

function ItineraryDaysManager({
  packageId,
  onDaysCountChange,
}: ItineraryDaysManagerProps) {
  const [itineraryDays, setItineraryDays] = useState<TourItineraryDay[]>([])
  const [activitiesByDay, setActivitiesByDay] = useState<ActivitiesByDay>({})
  const [imageCountsByDay, setImageCountsByDay] = useState<ImageCountsByDay>({})
  const [activityInputs, setActivityInputs] = useState<Record<string, ActivityFormState>>({})
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [editingActivityTitle, setEditingActivityTitle] = useState('')
  const [editingActivityDescription, setEditingActivityDescription] = useState('')
  const [activityIdToDelete, setActivityIdToDelete] = useState<string | null>(null)
  const [newDay, setNewDay] = useState<DayFormState>(emptyFormState)
  const [editingDayId, setEditingDayId] = useState<string | null>(null)
  const [editingDay, setEditingDay] = useState<DayFormState>(emptyFormState)
  const [dayIdToDelete, setDayIdToDelete] = useState<string | null>(null)
  const [openDayId, setOpenDayId] = useState<string | null>(null)
  const [highlightedDayId, setHighlightedDayId] = useState<string | null>(null)
  const [isAddDayModalOpen, setIsAddDayModalOpen] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingActivities, setIsLoadingActivities] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSavingOrder, setIsSavingOrder] = useState(false)
  const [draggedDayId, setDraggedDayId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [addingActivityDayId, setAddingActivityDayId] = useState<string | null>(null)
  const [isSavingActivity, setIsSavingActivity] = useState(false)
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null)
  const dayRefs = useRef<Record<string, HTMLElement | null>>({})
  const itineraryDaysRef = useRef<TourItineraryDay[]>([])
  const dragStartDaysRef = useRef<TourItineraryDay[]>([])
  const suppressNextClickRef = useRef(false)

  useEffect(() => {
    itineraryDaysRef.current = itineraryDays
  }, [itineraryDays])

  const loadImagesForDays = useCallback(async (days: TourItineraryDay[]) => {
    const dayIds = days.map((day) => day.id)

    try {
      const images = await getImagesForPackageDays(dayIds)
      setImageCountsByDay(groupImageCountsByDay(images))
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : String(loadError)

      setError(message || 'Unable to load itinerary image counts. Please try again.')
    }
  }, [])
  const loadActivitiesForDays = useCallback(async (days: TourItineraryDay[]) => {
    const dayIds = days.map((day) => day.id)

    setIsLoadingActivities(true)

    try {
      const activities = await getActivitiesForPackageDays(dayIds)
      setActivitiesByDay(groupActivitiesByDay(activities))
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : String(loadError)

      setError(message || 'Unable to load itinerary activities. Please try again.')
    } finally {
      setIsLoadingActivities(false)
    }
  }, [])

  const loadItineraryDays = useCallback(async () => {
    setError('')
    setIsLoading(true)

    try {
      const days = await getPackageItineraryDays(packageId)
      const orderedDays = sortAndNormalizeItineraryDays(days)
      setItineraryDays(orderedDays)
      onDaysCountChange?.(orderedDays.length)
      setNewDay((current) => ({
        ...current,
        day_number: String(orderedDays.length + 1),
      }))
      await Promise.all([loadActivitiesForDays(orderedDays), loadImagesForDays(orderedDays)])
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : String(loadError)

      setError(message || 'Unable to load itinerary days. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [loadActivitiesForDays, loadImagesForDays, onDaysCountChange, packageId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadItineraryDays(), 0)
    return () => window.clearTimeout(timer)
  }, [loadItineraryDays])

  const updateNewDayField = (field: keyof DayFormState, value: string) => {
    setNewDay((current) => ({ ...current, [field]: value }))
  }

  const updateEditingDayField = (field: keyof DayFormState, value: string) => {
    setEditingDay((current) => ({ ...current, [field]: value }))
  }

  const validateDayForm = (form: DayFormState) => {
    if (!form.title.trim()) {
      return 'Day title is required.'
    }

    return ''
  }

  const handleAddDay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    const validationError = validateDayForm(newDay)

    if (validationError) {
      setError(validationError)
      return
    }

    setIsAdding(true)

    try {
      const nextDayNumber = itineraryDays.length + 1
      const createdDay = await createItineraryDay({
        package_id: packageId,
        day_number: nextDayNumber,
        title: newDay.title.trim(),
        overview: newDay.overview.trim(),
        accommodation_name: newDay.accommodation_name.trim() || null,
        sort_order: nextDayNumber,
      })

      const nextDays = normalizeItineraryDays([...itineraryDays, createdDay])
      setItineraryDays(nextDays)
      onDaysCountChange?.(nextDays.length)
      setActivitiesByDay((current) => ({ ...current, [createdDay.id]: [] }))
      setImageCountsByDay((current) => ({ ...current, [createdDay.id]: 0 }))
      setOpenDayId(createdDay.id)
      setHighlightedDayId(createdDay.id)
      setNewDay({
        ...emptyFormState,
        day_number: String(nextDays.length + 1),
      })
      setSuccessMessage('Itinerary day added.')
      setIsAddDayModalOpen(false)
      window.setTimeout(() => {
        dayRefs.current[createdDay.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
      window.setTimeout(() => setHighlightedDayId(null), 1800)
    } catch (addError) {
      const message = addError instanceof Error ? addError.message : String(addError)
      setError(message || 'Unable to add itinerary day. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const startEditing = (day: TourItineraryDay) => {
    setEditingDayId(day.id)
    setEditingDay(toFormState(day))
    setOpenDayId(day.id)
    setDayIdToDelete(null)
    setError('')
    setSuccessMessage('')
  }

  const cancelEditing = () => {
    setEditingDayId(null)
    setEditingDay(emptyFormState)
  }

  const saveEditing = async (dayId: string) => {
    const validationError = validateDayForm(editingDay)

    if (validationError) {
      setError(validationError)
      return
    }

    setIsSavingEdit(true)
    setError('')
    setSuccessMessage('')

    try {
      const updatedDay = await updateItineraryDay(dayId, {
        title: editingDay.title.trim(),
        overview: editingDay.overview.trim(),
        accommodation_name: editingDay.accommodation_name.trim() || null,
      })

      setItineraryDays((currentDays) =>
        currentDays
          .map((day) => (day.id === dayId ? updatedDay : day))
          .sort(sortDays),
      )
      cancelEditing()
      setSuccessMessage('Itinerary day updated.')
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : String(updateError)
      setError(message || 'Unable to update itinerary day. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const confirmDelete = async (dayId: string) => {
    setIsDeleting(true)
    setError('')
    setSuccessMessage('')

    try {
      await deleteItineraryDay(dayId)
      const nextDays = normalizeItineraryDays(
        itineraryDays.filter((day) => day.id !== dayId),
      )
      setItineraryDays(nextDays)
      onDaysCountChange?.(nextDays.length)
      setActivitiesByDay((current) => {
        const nextActivities = { ...current }
        delete nextActivities[dayId]
        return nextActivities
      })
      setImageCountsByDay((current) => {
        const nextCounts = { ...current }
        delete nextCounts[dayId]
        return nextCounts
      })
      setOpenDayId((currentDayId) => (currentDayId === dayId ? null : currentDayId))
      setHighlightedDayId((currentDayId) => (currentDayId === dayId ? null : currentDayId))
      setDayIdToDelete(null)
      setNewDay((current) => ({
        ...current,
        day_number: String(nextDays.length + 1),
      }))
      try {
        await updateItineraryDaysOrder(
          nextDays.map(({ id, day_number, sort_order }) => ({
            id,
            day_number,
            sort_order,
          })),
        )
        setSuccessMessage('Itinerary day deleted and remaining days renumbered.')
      } catch (orderError) {
        const message = orderError instanceof Error ? orderError.message : String(orderError)
        setError(
          message ||
            'The day was deleted, but the remaining day numbers could not be saved. Reloading the itinerary.',
        )
        void loadItineraryDays()
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete itinerary day. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddActivity = async (
    event: FormEvent<HTMLFormElement>,
    dayId: string,
  ) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    const activityTitle = (activityInputs[dayId]?.title ?? '').trim()
    const activityDescription = (activityInputs[dayId]?.description ?? '').trim()

    if (!activityTitle) {
      setError('Activity title is required.')
      return
    }

    const existingActivities = activitiesByDay[dayId] ?? []
    const nextSortOrder =
      existingActivities.length > 0
        ? Math.max(...existingActivities.map((activity) => activity.sort_order)) + 1
        : 1

    setAddingActivityDayId(dayId)

    try {
      const createdActivity = await createItineraryActivity({
        itinerary_day_id: dayId,
        title: activityTitle,
        description: activityDescription || null,
        sort_order: nextSortOrder,
      })

      setActivitiesByDay((current) => ({
        ...current,
        [dayId]: [...(current[dayId] ?? []), createdActivity].sort(sortActivities),
      }))
      setActivityInputs((current) => ({
        ...current,
        [dayId]: { title: '', description: '' },
      }))
      setOpenDayId(dayId)
      setSuccessMessage('Activity added.')
    } catch (addError) {
      const message = addError instanceof Error ? addError.message : String(addError)
      setError(message || 'Unable to add activity. Please try again.')
    } finally {
      setAddingActivityDayId(null)
    }
  }

  const toggleDay = (dayId: string) => {
    setOpenDayId((currentDayId) => (currentDayId === dayId ? null : dayId))
  }

  const saveDayOrder = async (
    orderedDays: TourItineraryDay[],
    previousDays: TourItineraryDay[],
  ) => {
    const normalizedDays = normalizeItineraryDays(orderedDays)
    setItineraryDays(normalizedDays)
    setNewDay((current) => ({
      ...current,
      day_number: String(normalizedDays.length + 1),
    }))
    setError('')
    setSuccessMessage('')
    setIsSavingOrder(true)

    try {
      await updateItineraryDaysOrder(
        normalizedDays.map(({ id, day_number, sort_order }) => ({
          id,
          day_number,
          sort_order,
        })),
      )
      setSuccessMessage('Itinerary order saved.')
    } catch (orderError) {
      const message = orderError instanceof Error ? orderError.message : String(orderError)
      console.error('Could not save itinerary order:', orderError)
      setItineraryDays(previousDays)
      setError(message || 'Could not save itinerary order. The previous order was restored.')
      void loadItineraryDays()
    } finally {
      setIsSavingOrder(false)
      setDraggedDayId(null)
    }
  }

  const startDayDrag = (dayId: string) => {
    if (isSavingOrder) return

    dragStartDaysRef.current = itineraryDaysRef.current
    suppressNextClickRef.current = false
    setDraggedDayId(dayId)
    setDropTarget(null)
    setError('')
    setSuccessMessage('')
  }

  const updateDropTarget = (
    event: {
      clientY: number
      currentTarget: HTMLElement
    },
    dayId: string,
  ) => {
    if (!draggedDayId || draggedDayId === dayId || isSavingOrder) {
      setDropTarget(null)
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const position = event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'

    setDropTarget((currentTarget) =>
      currentTarget?.dayId === dayId && currentTarget.position === position
        ? currentTarget
        : { dayId, position },
    )
  }

  const getOrderedDaysForDrop = () => {
    if (!draggedDayId || !dropTarget) {
      return itineraryDaysRef.current
    }

    const currentDays = itineraryDaysRef.current
    const draggedDay = currentDays.find((day) => day.id === draggedDayId)

    if (!draggedDay) {
      return currentDays
    }

    const daysWithoutDragged = currentDays.filter((day) => day.id !== draggedDayId)
    const targetIndex = daysWithoutDragged.findIndex((day) => day.id === dropTarget.dayId)

    if (targetIndex < 0) {
      return currentDays
    }

    const insertIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1
    const nextDays = [...daysWithoutDragged]
    nextDays.splice(insertIndex, 0, draggedDay)

    return normalizeItineraryDays(nextDays)
  }

  const finishDayDrag = () => {
    if (!draggedDayId) return

    const nextDays = getOrderedDaysForDrop()
    const previousDays = dragStartDaysRef.current
    setDraggedDayId(null)
    setDropTarget(null)

    if (hasOrderChanged(previousDays, nextDays)) {
      suppressNextClickRef.current = true
      void saveDayOrder(nextDays, previousDays)
    }

    window.setTimeout(() => {
      suppressNextClickRef.current = false
    }, 0)
  }

  const moveDay = (dayId: string, direction: -1 | 1) => {
    if (isSavingOrder) return

    const currentIndex = itineraryDays.findIndex((day) => day.id === dayId)
    const targetIndex = currentIndex + direction

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= itineraryDays.length) {
      return
    }

    const nextDays = [...itineraryDays]
    const [movedDay] = nextDays.splice(currentIndex, 1)
    nextDays.splice(targetIndex, 0, movedDay)
    void saveDayOrder(nextDays, itineraryDays)
  }

  const startEditingActivity = (activity: TourItineraryActivity) => {
    setEditingActivityId(activity.id)
    setEditingActivityTitle(activity.title)
    setEditingActivityDescription(activity.description ?? '')
    setActivityIdToDelete(null)
    setError('')
    setSuccessMessage('')
  }

  const cancelEditingActivity = () => {
    setEditingActivityId(null)
    setEditingActivityTitle('')
    setEditingActivityDescription('')
  }

  const saveActivity = async (activity: TourItineraryActivity) => {
    const activityTitle = editingActivityTitle.trim()
    const activityDescription = editingActivityDescription.trim()

    if (!activityTitle) {
      setError('Activity title is required.')
      return
    }

    setIsSavingActivity(true)
    setError('')
    setSuccessMessage('')

    try {
      const updatedActivity = await updateItineraryActivity(activity.id, {
        title: activityTitle,
        description: activityDescription || null,
      })

      setActivitiesByDay((current) => ({
        ...current,
        [activity.itinerary_day_id]: (current[activity.itinerary_day_id] ?? [])
          .map((currentActivity) =>
            currentActivity.id === activity.id ? updatedActivity : currentActivity,
          )
          .sort(sortActivities),
      }))
      cancelEditingActivity()
      setSuccessMessage('Activity updated.')
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : String(updateError)
      setError(message || 'Unable to update activity. Please try again.')
    } finally {
      setIsSavingActivity(false)
    }
  }

  const confirmDeleteActivity = async (activity: TourItineraryActivity) => {
    setDeletingActivityId(activity.id)
    setError('')
    setSuccessMessage('')

    try {
      await deleteItineraryActivity(activity.id)
      setActivitiesByDay((current) => ({
        ...current,
        [activity.itinerary_day_id]: (current[activity.itinerary_day_id] ?? []).filter(
          (currentActivity) => currentActivity.id !== activity.id,
        ),
      }))
      setActivityIdToDelete(null)
      setSuccessMessage('Activity deleted.')
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete activity. Please try again.')
    } finally {
      setDeletingActivityId(null)
    }
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-[90rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:w-[92%] md:p-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-brand-200 bg-brand-50 text-admin-accent">
              <FiCalendar className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="break-words text-base font-semibold text-slate-950">
              Day-by-Day Itinerary
            </h2>
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-admin-muted">
            Create the daily plan travelers will see on the tour details page.
          </p>
          <p className="mt-1 break-words text-sm leading-6 text-admin-muted">
            Drag days to reorder them. Day numbers update automatically.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSavingOrder ? (
            <div className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-sm font-semibold text-admin-accent">
              Saving order...
            </div>
          ) : null}
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
            {itineraryDays.length} day{itineraryDays.length === 1 ? '' : 's'} added
          </div>
          <button
            type="button"
            onClick={() => {
              setIsAddDayModalOpen(true)
              setError('')
              setSuccessMessage('')
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-admin-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            Add Itinerary Day
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {isAddDayModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-itinerary-day-title"
            className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h3
                  id="add-itinerary-day-title"
                  className="break-words text-base font-semibold text-slate-950"
                >
                  Add Itinerary Day
                </h3>
                <p className="mt-1 break-words text-sm text-admin-muted">
                  Create a new day for this package itinerary.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDayModalOpen(false)}
                disabled={isAdding}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                aria-label="Close add itinerary day modal"
                title="Close"
              >
                <FiX className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleAddDay} className="p-5">
              {error ? (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">
                    Day Number
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={newDay.day_number}
                    readOnly
                    className={`${inputClassName} cursor-not-allowed bg-slate-50 text-slate-500`}
                    placeholder="1"
                  />
                  <p className="mt-1 break-words text-xs text-admin-muted">
                    Day numbers are managed automatically by the itinerary order.
                  </p>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">
                    Day Title <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    value={newDay.title}
                    onChange={(event) => updateNewDayField('title', event.target.value)}
                    className={inputClassName}
                    placeholder="e.g. Arrival and Settling In"
                  />
                </label>

                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-800">
                    Overview
                  </span>
                  <textarea
                    value={newDay.overview}
                    onChange={(event) => updateNewDayField('overview', event.target.value)}
                    className={textareaClassName}
                    placeholder="Describe what happens on this day."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">
                    Accommodation Name
                  </span>
                  <input
                    type="text"
                    value={newDay.accommodation_name}
                    onChange={(event) =>
                      updateNewDayField('accommodation_name', event.target.value)
                    }
                    className={inputClassName}
                    placeholder="e.g. Paraa Safari Lodge"
                  />
                </label>

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={isAdding}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-admin-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
                  >
                    <FiPlus className="h-4 w-4" aria-hidden="true" />
                    {isAdding ? 'Adding...' : 'Add Itinerary Day'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-36 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : itineraryDays.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-800">
              No itinerary days added yet.
            </p>
            <p className="mt-1 break-words text-sm text-admin-muted">
              Add the first day for this package.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {itineraryDays.map((day) => {
              const dayActivities = activitiesByDay[day.id] ?? []
              const dayImageCount = imageCountsByDay[day.id] ?? 0
              const isEditing = editingDayId === day.id
              const isConfirmingDelete = dayIdToDelete === day.id
              const isOpen = openDayId === day.id
              const isHighlighted = highlightedDayId === day.id

              return (
                <article
                  key={day.id}
                  ref={(element) => {
                    dayRefs.current[day.id] = element
                  }}
                  draggable={!isEditing && !isSavingOrder}
                  onDragStart={(event) => {
                    const target = event.target as HTMLElement
                    const isControl = target.closest('button,input,textarea')

                    if (isControl) {
                      event.preventDefault()
                      return
                    }

                    event.dataTransfer.effectAllowed = 'move'
                    startDayDrag(day.id)
                  }}
                  onDragOver={(event) => {
                    if (draggedDayId && !isSavingOrder) {
                      event.preventDefault()
                      updateDropTarget(event, day.id)
                    }
                  }}
                  onDragEnter={(event) => {
                    if (draggedDayId && !isSavingOrder) {
                      event.preventDefault()
                      updateDropTarget(event, day.id)
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    finishDayDrag()
                  }}
                  onDragEnd={finishDayDrag}
                  className={`relative scroll-mt-6 overflow-visible rounded-2xl border bg-white shadow-sm transition-all duration-300 ease-in-out ${isOpen ? 'border-slate-300 ring-1 ring-slate-200' : 'border-slate-200 hover:border-slate-300'} ${isHighlighted ? 'ring-2 ring-brand-200' : ''} ${draggedDayId === day.id ? 'scale-[0.99] opacity-70 shadow-lg' : ''}`}
                  aria-grabbed={draggedDayId === day.id}
                >
                  {dropTarget?.dayId === day.id ? (
                    <div
                      className={`pointer-events-none absolute left-4 right-4 z-10 h-0.5 rounded-full bg-admin-accent shadow-[0_0_8px_rgba(249,115,22,0.35)] ${
                        dropTarget.position === 'before' ? '-top-2' : '-bottom-2'
                      }`}
                    />
                  ) : null}
                  <div
                    className={`flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl bg-slate-100 p-4 transition-colors duration-300 hover:bg-slate-200 md:p-5 lg:flex-row lg:items-start lg:justify-between ${isEditing ? '' : 'cursor-grab active:cursor-grabbing'}`}
                    onClick={() => {
                      if (suppressNextClickRef.current) {
                        suppressNextClickRef.current = false
                        return
                      }

                      if (!isEditing) {
                        toggleDay(day.id)
                      }
                    }}
                  >
                    <div className="flex min-w-0 flex-1 gap-4">
                      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-center text-slate-950 shadow-sm ring-1 ring-white/80">
                        <span className="text-[0.62rem] font-extrabold uppercase leading-none tracking-[0.12em] text-slate-700">
                          Day
                        </span>
                        <span className="mt-0.5 text-lg font-black leading-none text-slate-950">
                          {day.day_number}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="min-w-0 flex-1 space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <input
                              type="number"
                              min="1"
                              value={editingDay.day_number}
                              readOnly
                              className={`${inputClassName} cursor-not-allowed bg-slate-50 text-slate-500`}
                              placeholder="1"
                            />
                            <input
                              type="text"
                              value={editingDay.title}
                              onChange={(event) =>
                                updateEditingDayField('title', event.target.value)
                              }
                              className={inputClassName}
                              placeholder="Day title"
                            />
                          </div>
                          <textarea
                            value={editingDay.overview}
                            onChange={(event) =>
                              updateEditingDayField('overview', event.target.value)
                            }
                            className={textareaClassName}
                            placeholder="Describe what happens on this day."
                          />
                          <input
                            type="text"
                            value={editingDay.accommodation_name}
                            onChange={(event) =>
                              updateEditingDayField('accommodation_name', event.target.value)
                            }
                            className={inputClassName}
                            placeholder="Accommodation name"
                          />
                          <p className="break-words text-xs text-admin-muted">
                            Day numbers are managed automatically by the itinerary order.
                          </p>
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-base font-semibold text-slate-950">
                            {day.title}
                          </h3>
                          {day.accommodation_name ? (
                            <p className="mt-1 break-words text-sm font-medium text-slate-700">
                              {day.accommodation_name}
                            </p>
                          ) : null}
                          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs font-medium text-slate-600">
                            <span>{dayActivities.length} activit{dayActivities.length === 1 ? 'y' : 'ies'}</span>
                            <span aria-hidden="true">·</span>
                            <span>{dayImageCount} image{dayImageCount === 1 ? '' : 's'}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div
                      className="flex shrink-0 flex-wrap gap-2 lg:justify-end"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEditing(day.id)}
                            disabled={isSavingEdit}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-admin-accent px-3 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiSave className="h-3.5 w-3.5" aria-hidden="true" />
                            {isSavingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSavingEdit}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                            Cancel
                          </button>
                        </>
                      ) : isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void confirmDelete(day.id)}
                            disabled={isDeleting}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDayIdToDelete(null)}
                            disabled={isDeleting}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => moveDay(day.id, -1)}
                            disabled={isSavingOrder || itineraryDays[0]?.id === day.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-40 sm:hidden"
                            aria-label="Move itinerary day up"
                            title="Move up"
                          >
                            <FiArrowUp className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveDay(day.id, 1)}
                            disabled={isSavingOrder || itineraryDays[itineraryDays.length - 1]?.id === day.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-40 sm:hidden"
                            aria-label="Move itinerary day down"
                            title="Move down"
                          >
                            <FiArrowDown className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(day)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-admin-accent hover:text-admin-accent"
                            aria-label="Edit itinerary day"
                            title="Edit itinerary day"
                          >
                            <FiEdit2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDayIdToDelete(day.id)
                              setOpenDayId(day.id)
                              setEditingDayId(null)
                              setError('')
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                            aria-label="Delete itinerary day"
                            title="Delete itinerary day"
                          >
                            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:border-admin-accent hover:text-admin-accent"
                            aria-label={isOpen ? 'Close itinerary day' : 'Open itinerary day'}
                            title={isOpen ? 'Close itinerary day' : 'Open itinerary day'}
                          >
                            <FiChevronDown
                              className={`h-4 w-4 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-admin-accent' : ''}`}
                              aria-hidden="true"
                            />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="space-y-4 border-t border-slate-200 bg-slate-50/50 p-4 md:p-5">
                        <div className="max-w-full overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="break-words text-sm font-semibold text-slate-900">
                              Day Overview
                            </h4>
                          </div>
                          <p className="mt-3 whitespace-normal break-words text-sm leading-6 text-admin-muted">
                            {day.overview || 'No overview added for this day yet.'}
                          </p>
                          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Accommodation
                            </p>
                            <p className="mt-1 break-words font-medium text-slate-800">
                              {day.accommodation_name || 'Not specified'}
                            </p>
                          </div>
                        </div>

                        <div className="max-w-full overflow-hidden rounded-xl bg-slate-100/70 p-4 ring-1 ring-slate-200/70">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="break-words text-sm font-semibold text-slate-900">
                        Activities
                      </h4>
                      <span className="text-xs font-medium text-admin-muted">
                        {dayActivities.length} item{dayActivities.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <form
                      onSubmit={(event) => void handleAddActivity(event, day.id)}
                      className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.25fr_auto] lg:items-end"
                    >
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-slate-700">
                          Activity Title <span className="text-red-600">*</span>
                        </span>
                        <input
                          type="text"
                          value={activityInputs[day.id]?.title ?? ''}
                          onChange={(event) =>
                            setActivityInputs((current) => ({
                              ...current,
                              [day.id]: {
                                ...(current[day.id] ?? { title: '', description: '' }),
                                title: event.target.value,
                              },
                            }))
                          }
                          className={inputClassName}
                          placeholder={activityPlaceholders[day.day_number % activityPlaceholders.length]}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold text-slate-700">
                          Description
                        </span>
                        <input
                          type="text"
                          value={activityInputs[day.id]?.description ?? ''}
                          onChange={(event) =>
                            setActivityInputs((current) => ({
                              ...current,
                              [day.id]: {
                                ...(current[day.id] ?? { title: '', description: '' }),
                                description: event.target.value,
                              },
                            }))
                          }
                          className={inputClassName}
                          placeholder="Optional details about this activity"
                        />
                      </label>
                      <button
                        type="submit"
                        disabled={addingActivityDayId === day.id}
                        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-admin-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <FiPlus className="h-4 w-4" aria-hidden="true" />
                        {addingActivityDayId === day.id ? 'Adding...' : 'Add Activity'}
                      </button>
                    </form>

                    <div className="mt-4">
                      {isLoadingActivities ? (
                        <div className="space-y-2">
                          {[0, 1].map((item) => (
                            <div key={item} className="h-10 animate-pulse rounded-lg bg-white" />
                          ))}
                        </div>
                      ) : dayActivities.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 break-words text-sm text-admin-muted">
                          No activities added for this day yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {dayActivities.map((activity) => {
                            const isEditingActivity = editingActivityId === activity.id
                            const isConfirmingActivityDelete = activityIdToDelete === activity.id

                            return (
                              <div
                                key={activity.id}
                                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="flex min-w-0 flex-1 items-start gap-2">
                                  <FiCheckCircle className="mt-1 h-4 w-4 shrink-0 text-admin-accent" aria-hidden="true" />
                                  {isEditingActivity ? (
                                    <div className="min-w-0 flex-1 space-y-2">
                                      <input
                                        type="text"
                                        value={editingActivityTitle}
                                        onChange={(event) => setEditingActivityTitle(event.target.value)}
                                        className={inputClassName}
                                        placeholder="Activity title"
                                      />
                                      <textarea
                                        value={editingActivityDescription}
                                        onChange={(event) => setEditingActivityDescription(event.target.value)}
                                        className={`${textareaClassName} min-h-[80px]`}
                                        placeholder="Optional details about this activity"
                                      />
                                    </div>
                                  ) : (
                                    <div className="min-w-0 flex-1">
                                      <p className="break-words text-sm font-semibold leading-6 text-slate-900">
                                        {activity.title}
                                      </p>
                                      {activity.description ? (
                                        <p className="mt-1 break-words text-sm leading-6 text-admin-muted">
                                          {activity.description}
                                        </p>
                                      ) : null}
                                    </div>
                                  )}
                                </div>

                                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                  {isEditingActivity ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void saveActivity(activity)}
                                        disabled={isSavingActivity}
                                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-admin-accent px-3 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        <FiSave className="h-3.5 w-3.5" aria-hidden="true" />
                                        {isSavingActivity ? 'Saving...' : 'Save'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditingActivity}
                                        disabled={isSavingActivity}
                                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                                        Cancel
                                      </button>
                                    </>
                                  ) : isConfirmingActivityDelete ? (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => void confirmDeleteActivity(activity)}
                                        disabled={deletingActivityId === activity.id}
                                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        {deletingActivityId === activity.id ? 'Deleting...' : 'Confirm'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActivityIdToDelete(null)}
                                        disabled={deletingActivityId === activity.id}
                                        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => startEditingActivity(activity)}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent"
                                        aria-label="Edit activity"
                                        title="Edit activity"
                                      >
                                        <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActivityIdToDelete(activity.id)
                                          setEditingActivityId(null)
                                          setError('')
                                        }}
                                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                                        aria-label="Delete activity"
                                        title="Delete activity"
                                      >
                                        <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                        </div>

                        <div className="max-w-full overflow-hidden rounded-xl bg-slate-100/70 p-4 ring-1 ring-slate-200/70">
                        <ItineraryDayImagesManager
                    packageId={packageId}
                    dayId={day.id}
                    dayNumber={day.day_number}
                    onImagesChange={(count) => setImageCountsByDay((current) => ({ ...current, [day.id]: count }))}
                  />
                      </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function groupActivitiesByDay(activities: TourItineraryActivity[]) {
  return activities.reduce<ActivitiesByDay>((groupedActivities, activity) => {
    const dayActivities = groupedActivities[activity.itinerary_day_id] ?? []

    return {
      ...groupedActivities,
      [activity.itinerary_day_id]: [...dayActivities, activity].sort(sortActivities),
    }
  }, {})
}

function groupImageCountsByDay(images: TourItineraryImage[]) {
  return images.reduce<ImageCountsByDay>((counts, image) => ({
    ...counts,
    [image.itinerary_day_id]: (counts[image.itinerary_day_id] ?? 0) + 1,
  }), {})
}
function sortActivities(
  first: TourItineraryActivity,
  second: TourItineraryActivity,
) {
  return first.sort_order - second.sort_order
}

function sortDays(first: TourItineraryDay, second: TourItineraryDay) {
  if (first.sort_order !== second.sort_order) {
    return first.sort_order - second.sort_order
  }

  return first.day_number - second.day_number
}

function normalizeItineraryDays(days: TourItineraryDay[]) {
  return days.map((day, index) => ({
    ...day,
    day_number: index + 1,
    sort_order: index + 1,
  }))
}

function sortAndNormalizeItineraryDays(days: TourItineraryDay[]) {
  return normalizeItineraryDays([...days].sort(sortDays))
}

function hasOrderChanged(
  previousDays: TourItineraryDay[],
  nextDays: TourItineraryDay[],
) {
  return previousDays.some((day, index) => day.id !== nextDays[index]?.id)
}

export default ItineraryDaysManager






















