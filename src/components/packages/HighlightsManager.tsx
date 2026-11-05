import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  FiCheckCircle,
  FiEdit2,
  FiPlus,
  FiSave,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import {
  createPackageHighlight,
  deletePackageHighlight,
  getPackageHighlights,
  updatePackageHighlight,
} from '../../services/packageService'
import type { TourHighlight } from '../../types/tourPackage'

type HighlightsManagerProps = {
  packageId: string
}

const inputClassName =
  'h-11 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

const textareaClassName =
  'min-h-[88px] w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

function HighlightsManager({ packageId }: HighlightsManagerProps) {
  const [highlights, setHighlights] = useState<TourHighlight[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [editingDescription, setEditingDescription] = useState('')
  const [highlightIdToDelete, setHighlightIdToDelete] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadHighlights = useCallback(async () => {
    setError('')
    setIsLoading(true)

    try {
      const highlightData = await getPackageHighlights(packageId)
      setHighlights(highlightData)
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : String(loadError)

      setError(message || 'Unable to load tour highlights. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [packageId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHighlights(), 0)
    return () => window.clearTimeout(timer)
  }, [loadHighlights])

  const handleAddHighlight = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    const title = newTitle.trim()
    const description = newDescription.trim()

    if (!title) {
      setError('Highlight title is required.')
      return
    }

    const nextSortOrder =
      highlights.length > 0
        ? Math.max(...highlights.map((highlight) => highlight.sort_order)) + 1
        : 1

    setIsAdding(true)

    try {
      const createdHighlight = await createPackageHighlight({
        title,
        description: description || null,
        package_id: packageId,
        sort_order: nextSortOrder,
      })

      setHighlights((currentHighlights) =>
        [...currentHighlights, createdHighlight].sort(
          (first, second) => first.sort_order - second.sort_order,
        ),
      )
      setNewTitle('')
      setNewDescription('')
      setSuccessMessage('Highlight added.')
    } catch (addError) {
      const message = addError instanceof Error ? addError.message : String(addError)
      setError(message || 'Unable to add highlight. Please try again.')
    } finally {
      setIsAdding(false)
    }
  }

  const startEditing = (highlight: TourHighlight) => {
    setEditingHighlightId(highlight.id)
    setEditingTitle(highlight.title)
    setEditingDescription(highlight.description ?? '')
    setHighlightIdToDelete(null)
    setError('')
    setSuccessMessage('')
  }

  const cancelEditing = () => {
    setEditingHighlightId(null)
    setEditingTitle('')
    setEditingDescription('')
  }

  const saveEditing = async (highlightId: string) => {
    const title = editingTitle.trim()
    const description = editingDescription.trim()

    if (!title) {
      setError('Highlight title is required.')
      return
    }

    setIsSavingEdit(true)
    setError('')
    setSuccessMessage('')

    try {
      const updatedHighlight = await updatePackageHighlight(highlightId, {
        title,
        description: description || null,
      })

      setHighlights((currentHighlights) =>
        currentHighlights.map((highlight) =>
          highlight.id === highlightId ? updatedHighlight : highlight,
        ),
      )
      setEditingHighlightId(null)
      setEditingTitle('')
      setEditingDescription('')
      setSuccessMessage('Highlight updated.')
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : String(updateError)
      setError(message || 'Unable to update highlight. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const confirmDelete = async (highlightId: string) => {
    setIsDeleting(true)
    setError('')
    setSuccessMessage('')

    try {
      await deletePackageHighlight(highlightId)
      setHighlights((currentHighlights) =>
        currentHighlights.filter((highlight) => highlight.id !== highlightId),
      )
      setHighlightIdToDelete(null)
      setSuccessMessage('Highlight deleted.')
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete highlight. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="mx-auto mt-8 w-full max-w-[90rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:w-[92%] md:p-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full border border-brand-200 bg-brand-50 text-admin-accent">
              <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="break-words text-base font-semibold text-slate-950">
              Tour Highlights
            </h2>
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-admin-muted">
            Add the key experiences travelers will see on the tour details page.
          </p>
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

      <form onSubmit={handleAddHighlight} className="mt-6 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1.3fr_auto] md:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Highlight Title <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              className={inputClassName}
              placeholder="e.g. Nile boat cruise"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Description
            </span>
            <input
              type="text"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              className={inputClassName}
              placeholder="Optional short description for this highlight"
            />
          </label>

          <button
            type="submit"
            disabled={isAdding}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-admin-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            {isAdding ? 'Adding...' : 'Add Highlight'}
          </button>
        </div>
      </form>

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : highlights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-800">
              No highlights added yet.
            </p>
            <p className="mt-1 break-words text-sm text-admin-muted">
              Add the first highlight for this package.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {highlights.map((highlight, index) => {
              const isEditing = editingHighlightId === highlight.id
              const isConfirmingDelete = highlightIdToDelete === highlight.id

              return (
                <div
                  key={highlight.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-admin-accent">
                        {index + 1}
                      </span>
                      {isEditing ? (
                        <div className="min-w-0 flex-1 space-y-3">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                            className={inputClassName}
                            placeholder="Highlight title"
                          />
                          <textarea
                            value={editingDescription}
                            onChange={(event) =>
                              setEditingDescription(event.target.value)
                            }
                            className={textareaClassName}
                            placeholder="Optional short description for this highlight"
                          />
                        </div>
                      ) : (
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold leading-6 text-slate-900">
                            {highlight.title}
                          </p>
                          {highlight.description ? (
                            <p className="mt-1 break-words text-sm leading-6 text-admin-muted">
                              {highlight.description}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEditing(highlight.id)}
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
                            onClick={() => void confirmDelete(highlight.id)}
                            disabled={isDeleting}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setHighlightIdToDelete(null)}
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
                            onClick={() => startEditing(highlight)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent"
                            aria-label="Edit highlight"
                            title="Edit highlight"
                          >
                            <FiEdit2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHighlightIdToDelete(highlight.id)
                              setEditingHighlightId(null)
                              setError('')
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                            aria-label="Delete highlight"
                            title="Delete highlight"
                          >
                            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default HighlightsManager

