import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  FiCheckCircle,
  FiChevronDown,
  FiDollarSign,
  FiFileText,
  FiGrid,
  FiImage,
  FiLink,
  FiList,
  FiMap,
  FiMinus,
  FiPackage,
  FiPlus,
  FiSave,
} from 'react-icons/fi'
import EmptyState from '../../components/ui/EmptyState'
import GalleryManager from '../../components/packages/GalleryManager'
import HighlightsManager from '../../components/packages/HighlightsManager'
import ItineraryDaysManager from '../../components/packages/ItineraryDaysManager'
import LocationsManager from '../../components/packages/LocationsManager'
import ImageUploadField from '../../components/ui/ImageUploadField'
import {
  getPackageItineraryDays,
  getTourPackageById,
  updateTourPackage,
} from '../../services/packageService'
import { uploadPackageImage } from '../../services/storageService'
import type {
  AccommodationTier,
  PackageStatus,
  TourPackage,
  UpdateTourPackageInput,
} from '../../types/tourPackage'

type FormState = {
  title: string
  slug: string
  category: string
  duration_days: string
  price_from_usd: string
  price_budget_usd: string
  price_mid_range_usd: string
  price_luxury_usd: string
  accommodation_tier: AccommodationTier
  short_description: string
  overview: string
  main_image_url: string
  hero_image_url: string
  map_style: string
  status: PackageStatus
}

type FormErrors = Partial<Record<keyof FormState, string>>
type EditSectionId = 'basic' | 'images' | 'highlights' | 'gallery' | 'itinerary' | 'locations'
type EditRouteState = {
  initialSection?: EditSectionId
  successMessage?: string
}

type EditSection = {
  id: EditSectionId
  title: string
  description: string
  icon: ReactNode
  badge?: string
}

const inputClassName =
  'mt-2 h-12 w-full max-w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200'

const textareaClassName =
  'mt-2 w-full max-w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 whitespace-pre-wrap break-words'

const categoryOptions = [
  'Safari',
  'Gorilla Trekking',
  'Cultural Tour',
  'Wildlife Tour',
  'Adventure Tour',
  'Family Tour',
]

const accommodationTierOptions: Array<{ value: AccommodationTier; label: string; helper: string }> = [
  { value: 'standard', label: 'Standard / Flexible', helper: 'Guests can choose budget, mid-range, or luxury while booking.' },
  { value: 'budget', label: 'Budget', helper: 'Marks this package as budget-led.' },
  { value: 'mid_range', label: 'Mid-range', helper: 'Marks this package as mid-range-led.' },
  { value: 'luxury', label: 'Luxury', helper: 'Locks booking accommodation to luxury.' },
]

const initialFormState: FormState = {
  accommodation_tier: 'standard',
  category: '',
  duration_days: '',
  hero_image_url: '',
  main_image_url: '',
  map_style: 'light',
  overview: '',
  price_from_usd: '',
  price_budget_usd: '',
  price_mid_range_usd: '',
  price_luxury_usd: '',
  short_description: '',
  slug: '',
  status: 'draft',
  title: '',
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function mapPackageToForm(tourPackage: TourPackage): FormState {
  const tier = tourPackage.accommodation_tier ?? 'standard'

  return {
    accommodation_tier: tier,
    category: tourPackage.category ?? '',
    duration_days: String(tourPackage.duration_days ?? ''),
    hero_image_url: tourPackage.hero_image_url ?? '',
    main_image_url: tourPackage.main_image_url ?? '',
    map_style: tourPackage.map_style ?? 'light',
    overview: tourPackage.overview ?? '',
    price_from_usd: String(tourPackage.price_from_usd ?? ''),
    price_budget_usd: String(tourPackage.price_budget_usd ?? (tier === 'budget' ? tourPackage.price_from_usd : '') ?? ''),
    price_mid_range_usd: String(tourPackage.price_mid_range_usd ?? (tier === 'mid_range' || tier === 'standard' ? tourPackage.price_from_usd : '') ?? ''),
    price_luxury_usd: String(tourPackage.price_luxury_usd ?? (tier === 'luxury' ? tourPackage.price_from_usd : '') ?? ''),
    short_description: tourPackage.short_description ?? '',
    slug: tourPackage.slug ?? '',
    status: tourPackage.status ?? 'draft',
    title: tourPackage.title ?? '',
  }
}

function validateForm(form: FormState) {
  const errors: FormErrors = {}

  if (!form.title.trim()) {
    errors.title = 'Title is required.'
  }

  if (!form.slug.trim()) {
    errors.slug = 'Slug is required.'
  }

  if (!form.duration_days.trim()) {
    errors.duration_days = 'Duration days is required.'
  } else if (Number(form.duration_days) <= 0) {
    errors.duration_days = 'Duration days must be greater than 0.'
  }

  ;(['price_from_usd', 'price_budget_usd', 'price_mid_range_usd', 'price_luxury_usd'] as const).forEach((field) => {
    if (form[field].trim() && Number(form[field]) < 0) {
      errors[field] = 'Price from USD cannot be negative.'
    }
  })

  return errors
}

function priceValue(value: string) {
  return value.trim() ? Number(value) : null
}

function getActivePriceFrom(form: FormState) {
  const budget = priceValue(form.price_budget_usd)
  const midRange = priceValue(form.price_mid_range_usd)
  const luxury = priceValue(form.price_luxury_usd)

  if (form.accommodation_tier === 'budget') return budget
  if (form.accommodation_tier === 'mid_range') return midRange
  if (form.accommodation_tier === 'luxury') return luxury

  return midRange ?? budget ?? luxury ?? priceValue(form.price_from_usd)
}

function accommodationLabel(tier: AccommodationTier) {
  return accommodationTierOptions.find((option) => option.value === tier)?.label ?? 'Standard / Flexible'
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-red-600">{message}</p> : null
}

function PriceField({
  label,
  value,
  error,
  onChange,
}: {
  label: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-medium text-slate-800">
        {label} <span className="text-xs font-normal text-admin-muted">(optional)</span>
      </span>
      <div className="mt-2 flex h-12 max-w-full overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200">
        <span className="inline-flex w-12 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-slate-600">
          $
        </span>
        <input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-full min-w-0 flex-1 border-0 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          placeholder="e.g. 1600"
        />
      </div>
      <FieldError message={error} />
    </label>
  )
}

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: ReactNode
  title: string
  description?: string
}) {
  return (
    <div className="mb-5 flex min-w-0 items-start gap-3">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-admin-accent shadow-sm">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="break-words text-base font-semibold text-slate-950">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-3xl break-words text-sm leading-6 text-admin-muted">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function EditPackagePage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const routeState = location.state as EditRouteState | null
  const [form, setForm] = useState<FormState>(initialFormState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [fetchError, setFetchError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState(routeState?.successMessage ?? '')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [mainImageFile, setMainImageFile] = useState<File | null>(null)
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null)
  const [isUploadingImages, setIsUploadingImages] = useState(false)
  const [isNotFound, setIsNotFound] = useState(false)
  const [isSlugEdited, setIsSlugEdited] = useState(false)
  const [activeSection, setActiveSection] = useState<EditSectionId>(routeState?.initialSection ?? 'basic')
  const [openMobileSection, setOpenMobileSection] = useState<EditSectionId | null>(routeState?.initialSection ?? 'basic')
  const [itineraryDayCount, setItineraryDayCount] = useState<number | null>(null)

  const editSections: EditSection[] = [
    {
      id: 'basic',
      title: 'Basic Info',
      description: 'Core package details, pricing, description, and publish state.',
      icon: <FiPackage className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'images',
      title: 'Images',
      description: 'Main card image and hero banner image.',
      icon: <FiImage className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'highlights',
      title: 'Highlights',
      description: 'Key experiences shown on the tour details page.',
      icon: <FiList className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'gallery',
      title: 'Gallery',
      description: 'Up to four images for the package gallery.',
      icon: <FiGrid className="h-4 w-4" aria-hidden="true" />,
      badge: 'Max 4',
    },
    {
      id: 'itinerary',
      title:
        itineraryDayCount === null
          ? 'Itinerary'
          : `Itinerary - ${itineraryDayCount} day${itineraryDayCount === 1 ? '' : 's'}`,
      description: 'Day plans, activities, and day images.',
      icon: <FiMap className="h-4 w-4" aria-hidden="true" />,
    },
    {
      id: 'locations',
      title: 'Route Map',
      description: 'Map pins, coordinates, and route order.',
      icon: <FiMap className="h-4 w-4" aria-hidden="true" />,
    },
  ]

  useEffect(() => {
    let isMounted = true

    async function loadPackage() {
      if (!id) {
        setIsNotFound(true)
        setIsLoading(false)
        return
      }

      setFetchError('')
      setIsLoading(true)

      try {
        const tourPackage = await getTourPackageById(id)

        if (!isMounted) return

        if (!tourPackage) {
          setIsNotFound(true)
          return
        }

        setForm(mapPackageToForm(tourPackage))
        setMainImageFile(null)
        setHeroImageFile(null)
      } catch (error) {
        if (!isMounted) return

        const message = error instanceof Error ? error.message : String(error)
        setFetchError(
          message || 'Unable to load this tour package. Please try again.',
        )
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadPackage()

    return () => {
      isMounted = false
    }
  }, [id])

  useEffect(() => {
    if (!routeState?.initialSection && !routeState?.successMessage) return

    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, navigate, routeState?.initialSection, routeState?.successMessage])

  useEffect(() => {
    let isMounted = true

    async function loadItineraryCount() {
      if (!id) {
        setItineraryDayCount(null)
        return
      }

      try {
        const days = await getPackageItineraryDays(id)

        if (isMounted) {
          setItineraryDayCount(days.length)
        }
      } catch {
        if (isMounted) {
          setItineraryDayCount(null)
        }
      }
    }

    void loadItineraryCount()

    return () => {
      isMounted = false
    }
  }, [id])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }))
  }

  const handleTitleChange = (value: string) => {
    setForm((currentForm) => ({
      ...currentForm,
      slug: isSlugEdited ? currentForm.slug : createSlug(value),
      title: value,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      slug: undefined,
      title: undefined,
    }))
  }

  const handleSlugChange = (value: string) => {
    setIsSlugEdited(true)
    updateField('slug', createSlug(value))
  }

  const changeDuration = (change: number) => {
    const currentDuration = Number(form.duration_days || 1)
    const nextDuration = Math.max(1, currentDuration + change)
    updateField('duration_days', String(nextDuration))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError('')
    setSuccessMessage('')

    if (!id) {
      setSubmitError('Missing package id. Return to the package list and try again.')
      return
    }

    const validationErrors = validateForm(form)
    setErrors(validationErrors)

    if (Object.keys(validationErrors).length > 0) {
      setActiveSection('basic')
      setOpenMobileSection('basic')
      return
    }

    const packageSlug = createSlug(form.slug)
    let mainImageUrl = form.main_image_url.trim()
    let heroImageUrl = form.hero_image_url.trim()

    setIsSaving(true)
    setIsUploadingImages(Boolean(mainImageFile || heroImageFile))

    try {
      if (mainImageFile) {
        mainImageUrl = await uploadPackageImage(mainImageFile, packageSlug, 'main')
      }

      if (heroImageFile) {
        heroImageUrl = await uploadPackageImage(heroImageFile, packageSlug, 'hero')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSubmitError(message || 'Unable to upload package images. Please try again.')
      setActiveSection('images')
      setOpenMobileSection('images')
      setIsSaving(false)
      setIsUploadingImages(false)
      return
    }

    const packageData: UpdateTourPackageInput = {
      category: form.category.trim(),
      duration_days: Number(form.duration_days),
      hero_image_url: heroImageUrl || null,
      main_image_url: mainImageUrl || null,
      map_style: form.map_style as UpdateTourPackageInput['map_style'],
      overview: form.overview.trim(),
      price_from_usd: getActivePriceFrom(form),
      price_budget_usd: priceValue(form.price_budget_usd),
      price_mid_range_usd: priceValue(form.price_mid_range_usd),
      price_luxury_usd: priceValue(form.price_luxury_usd),
      accommodation_tier: form.accommodation_tier,
      short_description: form.short_description.trim(),
      slug: packageSlug,
      status: form.status,
      title: form.title.trim(),
    }

    try {
      const updatedPackage = await updateTourPackage(id, packageData)
      setForm(mapPackageToForm(updatedPackage))
      setMainImageFile(null)
      setHeroImageFile(null)
      setSuccessMessage('Tour package updated successfully.')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSubmitError(
        message || 'Unable to update the tour package. Please try again.',
      )
    } finally {
      setIsSaving(false)
      setIsUploadingImages(false)
    }
  }

  const formMessages = (
    <>
      {submitError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 break-words">
          {submitError}
        </div>
      ) : null}

      {successMessage ? (
        <div className="flex min-w-0 items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          <FiCheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{successMessage}</span>
        </div>
      ) : null}
    </>
  )

  const formActions = (
    <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-start">
      <Link
        to="/packages"
        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Cancel
      </Link>
      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-admin-accent px-6 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <FiSave className="h-4 w-4" aria-hidden="true" />
        {isSaving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )

  const basicInfoContent = (
    <div className="space-y-8">
      {formMessages}

      <section className="min-w-0">
        <SectionHeader
          icon={<FiPackage className="h-4 w-4" aria-hidden="true" />}
          title="Basic Package Information"
          description="Update the name, slug, category, publishing state, price, duration, and public descriptions."
        />
        <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Title <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={form.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              className={inputClassName}
            />
            <FieldError message={errors.title} />
          </label>

          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Slug <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={form.slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              className={inputClassName}
            />
            <p className="mt-1 break-words text-xs text-admin-muted">
              Auto-generated from the title unless you edit it.
            </p>
            <FieldError message={errors.slug} />
          </label>

          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Category
            </span>
            <select
              value={form.category}
              onChange={(event) => updateField('category', event.target.value)}
              className={inputClassName}
            >
              <option value="">Select a category</option>
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Status
            </span>
            <select
              value={form.status}
              onChange={(event) =>
                updateField('status', event.target.value as PackageStatus)
              }
              className={inputClassName}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>

          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Accommodation Package Type
            </span>
            <select
              value={form.accommodation_tier}
              onChange={(event) => updateField('accommodation_tier', event.target.value as AccommodationTier)}
              className={inputClassName}
            >
              {accommodationTierOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 break-words text-xs text-admin-muted">
              {accommodationTierOptions.find((option) => option.value === form.accommodation_tier)?.helper}
            </p>
          </label>

          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Map Style
            </span>
            <select
              value={form.map_style}
              onChange={(event) => updateField('map_style', event.target.value)}
              className={inputClassName}
            >
              <option value="light">Light gray</option>
              <option value="green">Green and white</option>
              <option value="warm">Warm sand</option>
              <option value="dark">Dark</option>
            </select>
            <p className="mt-1 break-words text-xs text-admin-muted">
              Controls the route map style on the public tour detail page.
            </p>
          </label>
        </div>
      </section>

      <section className="min-w-0 border-t border-slate-200 pt-8">
        <SectionHeader
          icon={<FiDollarSign className="h-4 w-4" aria-hidden="true" />}
          title="Pricing & Duration"
          description="Control the price and number of days shown across the public package pages."
        />
        <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Duration Days <span className="text-red-600">*</span>
            </span>
            <div className="mt-2 flex h-12 max-w-full overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200">
              <button
                type="button"
                onClick={() => changeDuration(-1)}
                className="inline-flex w-12 shrink-0 items-center justify-center border-r border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-admin-accent"
                aria-label="Decrease duration days"
              >
                <FiMinus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input
                type="number"
                min="1"
                value={form.duration_days}
                onChange={(event) => updateField('duration_days', event.target.value)}
                className="h-full min-w-0 flex-1 border-0 px-4 text-center text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Select number of days"
              />
              <button
                type="button"
                onClick={() => changeDuration(1)}
                className="inline-flex w-12 shrink-0 items-center justify-center border-l border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-admin-accent"
                aria-label="Increase duration days"
              >
                <FiPlus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <FieldError message={errors.duration_days} />
          </label>

          <label className="block min-w-0 md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Price From USD - {accommodationLabel(form.accommodation_tier)} <span className="text-xs font-normal text-admin-muted">(auto-calculated)</span>
            </span>
            <div className="mt-2 flex h-12 max-w-full overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-200">
              <span className="inline-flex w-12 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-slate-600">
                $
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={String(getActivePriceFrom(form) ?? '')}
                readOnly
                className="h-full min-w-0 flex-1 border-0 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Fill a package type price below"
              />
            </div>
            <FieldError message={errors.price_from_usd} />
          </label>

          {(form.accommodation_tier === 'standard' || form.accommodation_tier === 'mid_range') ? (
            <PriceField label="Mid-range price USD" value={form.price_mid_range_usd} error={errors.price_mid_range_usd} onChange={(value) => updateField('price_mid_range_usd', value)} />
          ) : null}
          {(form.accommodation_tier === 'standard' || form.accommodation_tier === 'budget') ? (
            <PriceField label="Budget price USD" value={form.price_budget_usd} error={errors.price_budget_usd} onChange={(value) => updateField('price_budget_usd', value)} />
          ) : null}
          {(form.accommodation_tier === 'standard' || form.accommodation_tier === 'luxury') ? (
            <PriceField label="Luxury price USD" value={form.price_luxury_usd} error={errors.price_luxury_usd} onChange={(value) => updateField('price_luxury_usd', value)} />
          ) : null}
        </div>
      </section>

      <section className="min-w-0 border-t border-slate-200 pt-8">
        <SectionHeader
          icon={<FiFileText className="h-4 w-4" aria-hidden="true" />}
          title="Descriptions"
          description="Keep card copy concise and use the overview for the full public tour detail page."
        />
        <div className="space-y-5">
          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Short Description
            </span>
            <textarea
              value={form.short_description}
              onChange={(event) => updateField('short_description', event.target.value)}
              rows={3}
              className={`${textareaClassName} min-h-[110px]`}
              placeholder="Write a short summary for the tour card."
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-2 block text-sm font-medium text-slate-800">
              Overview
            </span>
            <textarea
              value={form.overview}
              onChange={(event) => updateField('overview', event.target.value)}
              rows={4}
              className={`${textareaClassName} min-h-[150px]`}
              placeholder="Write the full tour overview shown on the details page."
            />
          </label>
        </div>
      </section>
    </div>
  )

  const imagesContent = (
    <div className="space-y-8">
      {formMessages}
      <section className="min-w-0">
        <SectionHeader
          icon={<FiLink className="h-4 w-4" aria-hidden="true" />}
          title="Package Images"
          description="Upload or replace the main package card image and the hero banner image. Save changes when you are done."
        />
        <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2">
          <div className="min-w-0">
            <ImageUploadField
              label="Main Image"
              helperText="Used on tour cards"
              value={form.main_image_url}
              selectedFile={mainImageFile}
              onChange={(value) => updateField('main_image_url', value)}
              onFileChange={setMainImageFile}
              disabled={isSaving}
              isUploading={isUploadingImages && Boolean(mainImageFile)}
            />
          </div>

          <div className="min-w-0">
            <ImageUploadField
              label="Hero Image"
              helperText="Used on tour details banner"
              value={form.hero_image_url}
              selectedFile={heroImageFile}
              onChange={(value) => updateField('hero_image_url', value)}
              onFileChange={setHeroImageFile}
              disabled={isSaving}
              isUploading={isUploadingImages && Boolean(heroImageFile)}
            />
          </div>
        </div>
      </section>
    </div>
  )

  const renderFormSection = (content: ReactNode) => (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-[90rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:w-[92%] md:p-8"
    >
      {content}
      {formActions}
    </form>
  )

  const renderSectionContent = (sectionId: EditSectionId) => {
    if (!id) return null

    switch (sectionId) {
      case 'basic':
        return renderFormSection(basicInfoContent)
      case 'images':
        return renderFormSection(imagesContent)
      case 'highlights':
        return <HighlightsManager packageId={id} />
      case 'gallery':
        return <GalleryManager packageId={id} />
      case 'itinerary':
        return (
          <ItineraryDaysManager
            packageId={id}
            onDaysCountChange={setItineraryDayCount}
          />
        )
      case 'locations':
        return <LocationsManager packageId={id} mapStyle={form.map_style} />
      default:
        return null
    }
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      {isLoading ? (
        <section className="mx-auto w-full max-w-[90rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:w-[92%] md:p-8">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        </section>
      ) : isNotFound ? (
        <EmptyState
          title="Package not found"
          description="This tour package could not be found. It may have been deleted or the link may be incorrect."
          action={
            <Link
              to="/packages"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Packages
            </Link>
          }
        />
      ) : fetchError ? (
        <section className="mx-auto w-full max-w-[90rem] overflow-hidden rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm md:w-[92%] md:p-8">
          <h2 className="break-words text-base font-semibold text-red-800">Could not load package</h2>
          <p className="mt-2 break-words text-sm leading-6 text-red-700">{fetchError}</p>
          <Link
            to="/packages"
            className="mt-5 inline-flex items-center justify-center rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
          >
            Back to Packages
          </Link>
        </section>
      ) : (
        <div className="space-y-5">
          <div className="mx-auto hidden w-full max-w-[90rem] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm md:block md:w-[92%]">
            <div className="flex gap-2 overflow-x-auto p-1">
              {editSections.map((section) => {
                const isActive = activeSection === section.id

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`group inline-flex min-w-max items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-brand-50 text-admin-accent ring-1 ring-brand-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                    }`}
                  >
                    <span className={isActive ? 'text-admin-accent' : 'text-slate-400 group-hover:text-admin-accent'}>
                      {section.icon}
                    </span>
                    {section.title}
                    {section.badge ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                        {section.badge}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="hidden md:block">{renderSectionContent(activeSection)}</div>

          <div className="space-y-3 md:hidden">
            {editSections.map((section) => {
              const isOpen = openMobileSection === section.id

              return (
                <section
                  key={section.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenMobileSection((currentSection) => currentSection === section.id ? null : section.id)}
                    className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 text-left"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${
                        isOpen
                          ? 'border-brand-200 bg-brand-50 text-admin-accent'
                          : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}>
                        {section.icon}
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold text-slate-950">
                          {section.title}
                        </span>
                        <span className="mt-0.5 block break-words text-xs leading-5 text-admin-muted">
                          {section.description}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {section.badge ? (
                        <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                          {section.badge}
                        </span>
                      ) : null}
                      <FiChevronDown
                        className={`h-5 w-5 text-slate-500 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180 text-admin-accent' : ''}`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="border-t border-slate-200 bg-slate-50/40 px-3 py-4">
                        {isOpen ? renderSectionContent(section.id) : null}
                      </div>
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default EditPackagePage

