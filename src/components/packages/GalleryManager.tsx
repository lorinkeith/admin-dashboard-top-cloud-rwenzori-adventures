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
  createGalleryImage,
  deleteGalleryImage,
  getPackageGalleryImages,
  updateGalleryImage,
} from '../../services/packageService'
import {
  uploadGalleryImage,
  validateImageFile,
} from '../../services/storageService'
import type { TourGalleryImage } from '../../types/tourPackage'

type GalleryManagerProps = {
  packageId: string
}

const MAX_GALLERY_IMAGES = 4

const inputClassName =
  'h-11 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

const textareaClassName =
  'min-h-[80px] w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

function getDefaultAltText(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function GalleryManager({ packageId }: GalleryManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [galleryImages, setGalleryImages] = useState<TourGalleryImage[]>([])
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

  const remainingSlots = Math.max(MAX_GALLERY_IMAGES - galleryImages.length, 0)
  const hasReachedLimit = galleryImages.length >= MAX_GALLERY_IMAGES

  const loadGalleryImages = useCallback(async () => {
    setError('')
    setIsLoading(true)

    try {
      const images = await getPackageGalleryImages(packageId)
      setGalleryImages(images)
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : String(loadError)

      setError(message || 'Unable to load gallery images. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [packageId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadGalleryImages(), 0)
    return () => window.clearTimeout(timer)
  }, [loadGalleryImages])

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
      setError('Maximum of 4 gallery images reached.')
      return
    }

    if (selectedFiles.length > remainingSlots) {
      setError(
        `You can only add ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'}. Each package can have a maximum of 4 gallery images.`,
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
      galleryImages.length > 0
        ? Math.max(...galleryImages.map((image) => image.sort_order)) + 1
        : 1

    setIsUploading(true)

    try {
      const createdImages: TourGalleryImage[] = []

      for (const [index, file] of selectedFiles.entries()) {
        const publicUrl = await uploadGalleryImage(file, packageId)
        const galleryImage = await createGalleryImage({
          package_id: packageId,
          image_url: publicUrl,
          alt_text: getDefaultAltText(file.name) || null,
          caption: null,
          sort_order: startingSortOrder + index,
        })

        createdImages.push(galleryImage)
      }

      setGalleryImages((currentImages) =>
        [...currentImages, ...createdImages].sort(
          (first, second) => first.sort_order - second.sort_order,
        ),
      )
      setSuccessMessage(
        `${createdImages.length} gallery image${createdImages.length === 1 ? '' : 's'} uploaded.`,
      )
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : String(uploadError)
      setError(message || 'Unable to upload gallery image. Please try again.')
      void loadGalleryImages()
    } finally {
      setIsUploading(false)
    }
  }

  const startEditing = (image: TourGalleryImage) => {
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
      const updatedImage = await updateGalleryImage(imageId, {
        alt_text: editingAltText.trim() || null,
        caption: editingCaption.trim() || null,
      })

      setGalleryImages((currentImages) =>
        currentImages.map((image) =>
          image.id === imageId ? updatedImage : image,
        ),
      )
      cancelEditing()
      setSuccessMessage('Gallery image updated.')
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : String(updateError)
      setError(message || 'Unable to update gallery image. Please try again.')
    } finally {
      setIsSavingEdit(false)
    }
  }

  const confirmDelete = async (image: TourGalleryImage) => {
    setIsDeleting(true)
    setError('')
    setSuccessMessage('')

    try {
      await deleteGalleryImage(image.id)
      setGalleryImages((currentImages) =>
        currentImages.filter((currentImage) => currentImage.id !== image.id),
      )
      setImageIdToDelete(null)
      setSuccessMessage('Gallery image deleted.')
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : String(deleteError)
      setError(message || 'Unable to delete gallery image. Please try again.')
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
              <FiImage className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="break-words text-base font-semibold text-slate-950">
              Gallery Images
            </h2>
          </div>
          <p className="mt-2 break-words text-sm leading-6 text-admin-muted">
            Upload up to 4 images shown in the package gallery on the tour details page.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
          {galleryImages.length} of {MAX_GALLERY_IMAGES} images added
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

      <div className="mt-6">
        {hasReachedLimit ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
            Maximum of 4 gallery images reached.
          </div>
        ) : (
          <button
            type="button"
            onClick={handleChooseFiles}
            disabled={isUploading || isLoading}
            className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiUploadCloud className="h-8 w-8 text-admin-accent" aria-hidden="true" />
            <span className="mt-3 break-words text-sm font-semibold text-slate-900">
              {isUploading ? 'Uploading...' : 'Upload gallery images'}
            </span>
            <span className="mt-1 break-words text-sm text-admin-muted">
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

      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : galleryImages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-800">
              No gallery images added yet.
            </p>
            <p className="mt-1 break-words text-sm text-admin-muted">
              Upload up to 4 images for this package gallery.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {galleryImages.map((image) => {
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
                      alt={image.alt_text || image.caption || 'Tour gallery image'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-3 p-4">
                    {isEditing ? (
                      <>
                        <label className="block">
                          <span className="mb-2 block text-xs font-semibold text-slate-700">
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
                          <span className="mb-2 block text-xs font-semibold text-slate-700">
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
                          {image.alt_text || image.caption || 'Untitled gallery image'}
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
                            onClick={() => void confirmDelete(image)}
                            disabled={isDeleting}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setImageIdToDelete(null)}
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
                            onClick={() => startEditing(image)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-admin-border bg-white text-admin-muted transition hover:border-admin-accent hover:text-admin-accent"
                            aria-label="Edit gallery image"
                            title="Edit gallery image"
                          >
                            <FiEdit2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setImageIdToDelete(image.id)
                              setEditingImageId(null)
                              setError('')
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                            aria-label="Delete gallery image"
                            title="Delete gallery image"
                          >
                            <FiTrash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </>
                      )}
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

export default GalleryManager

