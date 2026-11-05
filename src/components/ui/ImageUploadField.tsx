import { useEffect, useId, useRef, useState } from 'react'
import { FiImage, FiRefreshCw, FiTrash2, FiUploadCloud } from 'react-icons/fi'
import { validateImageFile } from '../../services/storageService'

type ImageUploadFieldProps = {
  disabled?: boolean
  error?: string
  helperText: string
  isUploading?: boolean
  label: string
  onChange: (value: string) => void
  onFileChange: (file: File | null) => void
  selectedFile: File | null
  value: string
}

function ImageUploadField({
  disabled = false,
  error,
  helperText,
  isUploading = false,
  label,
  onChange,
  onFileChange,
  selectedFile,
  value,
}: ImageUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [localError, setLocalError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(value)

  useEffect(() => {
    if (!selectedFile) {
      const timer = window.setTimeout(() => setPreviewUrl(value), 0)
      return () => window.clearTimeout(timer)
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    const timer = window.setTimeout(() => setPreviewUrl(objectUrl), 0)

    return () => {
      window.clearTimeout(timer)
      URL.revokeObjectURL(objectUrl)
    }
  }, [selectedFile, value])

  const chooseFile = () => {
    if (!disabled) {
      inputRef.current?.click()
    }
  }

  const handleFileChange = (file: File | undefined) => {
    setLocalError('')

    if (!file) {
      return
    }

    const validationError = validateImageFile(file)

    if (validationError) {
      setLocalError(validationError)
      onFileChange(null)
      return
    }

    onFileChange(file)
  }

  const handleClear = () => {
    setLocalError('')
    onFileChange(null)
    onChange('')

    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const currentError = localError || error
  const hasImage = Boolean(previewUrl)

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{label}</p>
          <p className="mt-1 text-xs text-admin-muted">{helperText}</p>
        </div>
        {isUploading ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-admin-accent">
            <FiRefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Uploading
          </span>
        ) : null}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled}
        onChange={(event) => handleFileChange(event.target.files?.[0])}
        className="sr-only"
      />

      <button
        type="button"
        onClick={chooseFile}
        disabled={disabled}
        className="mt-4 flex min-h-44 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 text-left transition hover:border-admin-accent hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {hasImage ? (
          <img
            src={previewUrl}
            alt=""
            className="h-44 w-full object-cover"
          />
        ) : (
          <span className="flex flex-col items-center px-6 py-8 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-admin-accent shadow-sm">
              <FiUploadCloud className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="mt-3 text-sm font-semibold text-slate-800">
              Choose image
            </span>
            <span className="mt-1 text-xs text-admin-muted">
              JPG, PNG, or WebP. Max 5MB.
            </span>
          </span>
        )}
      </button>

      {currentError ? (
        <p className="mt-2 text-xs text-red-600">{currentError}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={chooseFile}
          disabled={disabled}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-admin-border bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-admin-accent hover:text-admin-accent disabled:cursor-not-allowed disabled:opacity-70"
        >
          {hasImage ? (
            <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <FiImage className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {hasImage ? 'Replace' : 'Upload'}
        </button>

        {hasImage ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <FiTrash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Remove
          </button>
        ) : null}
      </div>
    </div>
  )
}

export default ImageUploadField
