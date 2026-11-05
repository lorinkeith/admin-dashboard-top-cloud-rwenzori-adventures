import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  FiEdit2,
  FiImage,
  FiSave,
  FiTrash2,
  FiUploadCloud,
  FiX,
} from 'react-icons/fi'
import {
  createItineraryImage,
  deleteItineraryImage,
  getImagesForDay,
  updateItineraryImage,
} from '../../services/packageService'
import {
  uploadItineraryDayImage,
  validateImageFile,
} from '../../services/storageService'
import type { TourItineraryImage } from '../../types/tourPackage'

type ItineraryDayImagesManagerProps = {
  packageId: string
  dayId: string
  dayNumber: number
  onImagesChange?: (count: number) => void
}

const MAX_DAY_IMAGES = 2

const imagesByDayCache = new Map<string, TourItineraryImage[]>()

const inputClassName =
  'h-10 w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

const textareaClassName =
  'min-h-[72px] w-full max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 whitespace-normal break-words'

function getDefaultAltText(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function ItineraryDayImagesManager({
  packageId,
  dayId,
  dayNumber,
  onImagesChange,
}: ItineraryDayImagesManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasLoadedImagesRef = useRef(false)
  const onImagesChangeRef = useRef(onImagesChange)
  const [images, setImages] = useState<TourItineraryImage[]>(
    () => imagesByDayCache.get(dayId) ?? [],
  )
  const [editingImageId, setEditingImageId] = useState<string | null>(null)
  const [editingAltText, setEditingAltText] = useState('')
  const [editingCaption, setEditingCaption] = useState('')
  const [imageIdToDelete, setImageIdToDelete] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const remainingSlots = Math.max(MAX_DAY_IMAGES - images.length, 0)
  const hasReachedLimit = images.length >= MAX_DAY_IMAGES

  useEffect(() => {
    onImagesChangeRef.current = onImagesChange
  }, [onImagesChange])

  const loadImages = useCallback(async () => {
    setError('')

    const cachedImages = imagesByDayCache.get(dayId)

    if (cachedImages) {
      setImages(cachedImages)
      onImagesChangeRef.current?.(cachedImages.length)
      hasLoadedImagesRef.current = true
      setIsLoading(false)
      return
    }

    if (!hasLoadedImagesRef.current) {
      setIsLoading(true)
    }

    try {
      const dayImages = await getImagesForDay(dayId)
      imagesByDayCache.set(dayId, dayImages)
      setImages(dayImages)
      onImagesChangeRef.current?.(dayImages.length)
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError)
      setError(message || 'Unable to load day images. Please try again.')
    } finally {
      hasLoadedImagesRef.current = true
      setIsLoading(false)
    }
  }, [dayId])

  useEffect(() => {
    hasLoadedImagesRef.current = imagesByDayCache.has(dayId)
    const timer = window.setTimeout(() => void loadImages(), 0)
    return () => window.clearTimeout(timer)
  }, [dayId, loadImages])

  const handleChooseFiles = () => {
    if (hasReachedLimit || isUploading) {
      return
    }

    fileInputRef.current?.click()
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? [])
    event.target.value = ''

    setError('')
    setSuccessMessage('')

    if (selectedFiles.length === 0) {
      return
    }

    if (hasReachedLimit) {
      setError('Maximum of 2 images reached for this day.')
      return
    }

    if (selectedFiles.length > remainingSlots) {
      setError(
        `You can only add ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}. Each itinerary day can have a maximum of 2 images.`,
      )
      return
    }

    for (const file of selectedFiles) {
      const validationError = validateImageFile(file)

      if (validationError) {
        setError(`${file.name}: ${validationError}`)
        return
      }
    }

    const startingSortOrder =
      images.length > 0
        ? Math.max(...images.map((image) => image.sort_order)) + 1
        : 1

    setIsUploading(true)

    try {
      const createdImages: TourItineraryImage[] = []

      for (const [index, file] of selectedFiles.entries()) {
        const publicUrl = await uploadItineraryDayImage(file, packageId, dayNumber)
        const image = await createItineraryImage({
          itinerary_day_id: dayId,
          image_url: publicUrl,
          alt_text: getDefaultAltText(file.name) || null,
          caption: null,
          sort_order: startingSortOrder + index,
        })

        createdImages.push(image)
      }

      setImages((currentImages) => {
        const nextImages = [...currentImages, ...createdImages].sort(sortImages)
        imagesByDayCache.set(dayId, nextImages)
        onImagesChangeRef.current?.(nextImages.length)
        return nextImages
      })
      setSuccessMessage(
        `${createdImages.length} image${createdImages.length === 1 ? '' : 's'} uploaded.`,
      )
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : String(uploadError)
      setError(message || 'Unable to upload day image. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const startEditing = (image: TourItineraryImage) => {
    setEditingImageId(image.id)
    setEditingAltText(image.alt_text ?? '')
    setEditingCaption(image.caption ?? '')
    setImageIdToDelete(null)
    setError('')
    setSuccessMessage('')
  }

  const cancelEditing = () => {
    setEditingImageId(null)
    setEditingAltText('')
    setEditingCaption('')
  }

  const saveEditing = async (imageId: string) => {
    setIsSavingEdit(true)
    setError('')
    setSuccessMessage('')

    try {
      const updatedImage = await updateItineraryImage(imageId, {
        alt_text: editingAltText.trim() || null,
        caption: editingCaption.trim() || null,
      })

      setImages((currentImages) => {
        const nextImages = currentImages.map((image) =>
          image.id === imageId ? updatedImage : image,
        )

        imagesByDayCache.set(dayId, nextImages)
        return nextImages
      })
      cancelEditing()
      setSuccessMessage('Day image updated.')
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : String(updateError)
      setError(message || 'Unable to update day image. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const confirmDelete = async (image: TourItineraryImage) => {
    setIsDeleting(true)
    setError('')
    setSuccessMessage('')

    try {
      await deleteItineraryImage(image.id)
      setImages((currentImages) => {
        const nextImages = currentImages.filter((currentImage) => currentImage.id !== image.id)
        imagesByDayCache.set(dayId, nextImages)
        onImagesChangeRef.current?.(nextImages.length)
        return nextImages
      })
      setImageIdToDelete(null)
      setSuccessMessage('Day image deleted.')
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete day image. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-full overflow-hidden rounded-xl bg-white/80 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full border border-brand-200 bg-brand-50 text-admin-accent">
            <FiImage className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div>
            <h4 className="break-words text-sm font-semibold text-slate-900">Day Images</h4>
            <p className="break-words text-xs text-admin-muted">
              {images.length} of {MAX_DAY_IMAGES} images added
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="mt-4">
        {hasReachedLimit ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
            Maximum of 2 images reached for this day.
          </div>
        ) : (
          <button
            type="button"
            onClick={handleChooseFiles}
            disabled={isUploading || (isLoading && images.length === 0)}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-5 text-center transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiUploadCloud className="h-6 w-6 text-admin-accent" aria-hidden="true" />
            <span className="mt-2 break-words text-sm font-semibold text-slate-900">
              {isUploading ? 'Uploading...' : 'Upload day images'}
            </span>
            <span className="mt-1 break-words text-xs text-admin-muted">
              JPG, PNG, or WebP. 5MB max each. {remainingSlots} slot{remainingSlots === 1 ? '' : 's'} remaining.
            </span>
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      <div className="mt-4">
        {images.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {images.map((image) => {
              const isEditing = editingImageId === image.id
              const isConfirmingDelete = imageIdToDelete === image.id

              return (
                <article
                  key={image.id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="aspect-[4/3] bg-slate-100">
                    <img
                      src={image.image_url}
                      alt={image.alt_text || image.caption || 'Itinerary day image'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-3 p-3">
                    {isEditing ? (
                      <>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                            Alt text
                          </span>
                          <input
                            type="text"
                            value={editingAltText}
                            onChange={(event) => setEditingAltText(event.target.value)}
                            className={inputClassName}
                            placeholder="Describe the image"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-semibold text-slate-700">
                            Caption
                          </span>
                          <textarea
                            value={editingCaption}
                            onChange={(event) => setEditingCaption(event.target.value)}
                            className={textareaClassName}
                            placeholder="Optional caption"
                          />
                        </label>
                      </>
                    ) : (
                      <div>
                        <p className="line-clamp-2 break-words text-sm font-semibold text-slate-900">
                          {image.alt_text || image.caption || 'Untitled day image'}
                        </p>
                        {image.caption ? (
                          <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-admin-muted">
                            {image.caption}
                          </p>
                        ) : null}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveEditing(image.id)}
                            disabled={isSavingEdit}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-admin-accent px-3 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiSave className="h-3.5 w-3.5" aria-hidden="true" />
                            {isSavingEdit ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            disabled={isSavingEdit}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiX className="h-3.5 w-3.5" aria-hidden="true" />
                            Cancel
                          </button>
                        </>
                      ) : isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void confirmDelete(image)}
                            disabled={isDeleting}
                            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {isDeleting ? 'Deleting...' : 'Confirm'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageIdToDelete(null)}
                            disabled={isDeleting}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(image)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent"
                            aria-label="Edit day image"
                            title="Edit day image"
                          >
                            <FiEdit2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImageIdToDelete(image.id)
                              setEditingImageId(null)
                              setError('')
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                            aria-label="Delete day image"
                            title="Delete day image"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[0, 1].map((item) => (
              <div key={item} className="aspect-[4/3] animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 break-words text-sm text-admin-muted">
            No images added for this day yet. Upload up to 2 images for this itinerary day.
          </p>
        )}
      </div>
    </div>
  )
}

function sortImages(first: TourItineraryImage, second: TourItineraryImage) {
  return first.sort_order - second.sort_order
}

export default ItineraryDayImagesManager




