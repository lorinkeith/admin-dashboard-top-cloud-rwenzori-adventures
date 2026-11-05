import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent, type TransitionEvent } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
  FiCamera,
  FiCompass,
  FiEdit3,
  FiEyeOff,
  FiHeart,
  FiHome,
  FiMap,
  FiMapPin,
  FiMenu,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiTrash2,
  FiUpload,
  FiUsers,
  FiX,
} from 'react-icons/fi'
import logoUrl from '../../assets/caelum-logo-green.png'
import { navigationItems } from '../../config/navigation'
import {
  getHomepageCustomization,
  publishHomepageCustomization,
  saveHomepageDraft,
  uploadHomepageImage,
} from '../../services/homeCustomizationService'
import { defaultHomeCustomization, mergeHomeCustomization } from '../../services/homeCustomizationDefaults'
import { getPackages } from '../../services/packageService'
import type { EditableButton, EditableImage, EditableNavLink, HomeCustomizationContent } from '../../types/homeCustomization'
import type { TourPackage } from '../../types/tourPackage'
import gorillaHeroUrl from '../../assets/tree-lions.jpg'
import { HeroSlidesManager } from '../../components/customize/HeroSlidesManager'
import { HeroSlidePreview } from '../../components/customize/HeroSlidePreview'
import type { HeroSliderContent } from '../../types/heroSlider'
import { legacyHeroSlider } from '../../utils/legacyHeroSlider'

type SectionId = keyof Pick<
  HomeCustomizationContent,
  'nav' | 'hero' | 'story' | 'signature' | 'journey' | 'why' | 'gallery' | 'reviews' | 'footer'
> | 'featuredTours' | 'footerBand'

const editableSections: Array<{ id: SectionId; label: string }> = [
  { id: 'hero', label: 'Hero' },
  { id: 'story', label: 'Story' },
  { id: 'signature', label: 'Signature' },
  { id: 'featuredTours', label: 'Tour Packages' },
  { id: 'journey', label: 'Journey' },
  { id: 'why', label: 'Why Travel' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'footerBand', label: 'Footer image' },
  { id: 'footer', label: 'Footer' },
]

const lockedHeroBackground: EditableImage = {
  src: gorillaHeroUrl,
  alt: 'Mountain gorilla in Uganda forest',
}

type GalleryDraftImage = {
  id: string
  file: File
  previewUrl: string
}

type ActiveElement =
  | { type: 'headerContent' }
  | { type: 'heroContent' }
  | { type: 'signatureItem'; index: number }
  | { type: 'signatureImage' }
  | { type: 'signatureContent' }
  | { type: 'storyBadge'; index: number }
  | { type: 'storyContent' }
  | { type: 'featuredToursContent' }
  | { type: 'journeyMedia' }
  | { type: 'journeyContent' }
  | { type: 'journeyButton' }
  | { type: 'whyContent' }
  | { type: 'whyCard'; index: number }
  | { type: 'galleryContent' }
  | { type: 'galleryImages' }
  | { type: 'reviewsContent' }
  | null

const signatureFallbackIcons = [FiMapPin, FiCamera, FiCompass, FiUsers, FiMap, FiHeart]
const whyFallbackIcons = [FiCompass, FiUsers, FiHeart, FiMap]

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function cloneContent(content: HomeCustomizationContent): HomeCustomizationContent {
  return JSON.parse(JSON.stringify(content)) as HomeCustomizationContent
}

function withLockedHeroBackground(content: HomeCustomizationContent): HomeCustomizationContent {
  const normalizedBadges = defaultHomeCustomization.story.badges.map((defaultBadge, index) => {
    const badge = content.story.badges[index]
    const isLegacyPlaceholder = badge?.src === '/icons.svg' || badge?.src === '/favicon.svg'

    if (!badge || isLegacyPlaceholder) {
      return {
        ...defaultBadge,
        href: badge?.href ?? defaultBadge.href,
      }
    }

    return {
      ...badge,
      href: badge.href ?? defaultBadge.href,
    }
  })

  return {
    ...content,
    hero: {
      ...content.hero,
      background: lockedHeroBackground,
    },
    story: {
      ...content.story,
      badges: normalizedBadges,
    },
  }
}

function formatPackagePrice(price: number | null) {
  if (!price || price <= 0) return 'Custom'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price)
}

function getPackageImage(tourPackage: TourPackage) {
  return tourPackage.main_image_url || tourPackage.hero_image_url || lockedHeroBackground.src
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength).trim()}...`
}

function getContentFingerprint(content: HomeCustomizationContent) {
  return JSON.stringify(withLockedHeroBackground(content))
}

function setByPath(content: HomeCustomizationContent, path: string, value: unknown) {
  const next = cloneContent(content)
  const parts = path.split('.')
  let cursor: Record<string, unknown> | unknown[] = next as unknown as Record<string, unknown>

  parts.slice(0, -1).forEach((part) => {
    if (Array.isArray(cursor)) {
      cursor = cursor[Number(part)] as Record<string, unknown>
    } else {
      cursor = cursor[part] as Record<string, unknown>
    }
  })

  const last = parts[parts.length - 1]
  if (Array.isArray(cursor)) {
    cursor[Number(last)] = value
  } else {
    cursor[last] = value
  }

  return next
}

function EditableField({
  label,
  value,
  multiline = false,
  align = 'left',
}: {
  label: string
  value: string
  multiline?: boolean
  align?: 'left' | 'center'
  onChange: (value: string) => void
}) {
  return (
    <span className="relative inline-block max-w-full">
      <button
        type="button"
        className={`${multiline ? `block w-full ${align === 'center' ? 'text-center' : 'text-left'}` : 'max-w-full'} rounded-md text-inherit outline-none ring-brand-300 transition hover:ring-2 focus:ring-2`}
        title={`Select ${label}`}
      >
        {value || <span className="text-slate-400">Empty text</span>}
      </button>
    </span>
  )
}

function ImageEditor({
  image,
  sectionId,
  onChange,
  className = '',
  isSelected = false,
  onSelect,
  children,
}: {
  image: EditableImage
  sectionId: string
  onChange: (image: EditableImage) => void
  className?: string
  isSelected?: boolean
  onSelect?: () => void
  children?: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const imageUrl = await uploadHomepageImage(file, sectionId)
      onChange({ ...image, src: imageUrl })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Could not upload image.')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div
      onClick={(event) => {
        if (!onSelect) return
        event.stopPropagation()
        onSelect()
      }}
      className={`group/image relative overflow-hidden outline-none transition ${isSelected ? 'ring-2 ring-brand-300' : ''} ${onSelect ? 'cursor-pointer hover:ring-2 hover:ring-brand-300' : ''} ${className}`}
    >
      {children ?? <img className="h-full w-full object-cover" src={image.src} alt={image.alt} />}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          inputRef.current?.click()
        }}
        className="absolute right-3 top-3 hidden items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-xl transition hover:bg-brand-50 hover:text-brand-600 group-hover/image:inline-flex"
      >
        {isUploading ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiUpload className="h-4 w-4" />}
        Image
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
    </div>
  )
}

function LinkEditor({
  title,
  links,
  onChange,
}: {
  title: string
  links: EditableNavLink[]
  onChange: (links: EditableNavLink[]) => void
}) {
  return (
    <div className="border-b border-slate-200/70 pb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <button
          type="button"
          onClick={() => onChange([...links, { id: createId('link'), label: 'New link', href: '/' }])}
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-50 px-2.5 text-xs font-bold text-brand-700 hover:bg-brand-100"
        >
          <FiPlus /> Add
        </button>
      </div>
      <div className="space-y-3">
        {links.map((link, index) => (
          <div key={link.id} className="grid gap-2 border-t border-slate-200/70 pt-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              value={link.label}
              onChange={(event) => onChange(links.map((item) => item.id === link.id ? { ...item, label: event.target.value } : item))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400"
              aria-label={`${title} label ${index + 1}`}
            />
            <input
              value={link.href}
              onChange={(event) => onChange(links.map((item) => item.id === link.id ? { ...item, href: event.target.value } : item))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-brand-400"
              aria-label={`${title} URL ${index + 1}`}
            />
            <button
              type="button"
              onClick={() => onChange(links.filter((item) => item.id !== link.id))}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
              aria-label={`Remove ${link.label}`}
            >
              <FiTrash2 />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ButtonEditor({
  label,
  button,
  onChange,
  showIcon = true,
}: {
  label: string
  button: EditableButton
  onChange: (button: EditableButton) => void
  showIcon?: boolean
}) {
  return (
    <div className="border-b border-slate-200/70 pb-5">
      <h3 className="mb-3 text-sm font-bold text-slate-900">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-400" value={button.text} onChange={(event) => onChange({ ...button, text: event.target.value })} placeholder="Button text" />
        <input className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-400" value={button.href ?? ''} onChange={(event) => onChange({ ...button, href: event.target.value })} placeholder="/link-or-action" />
        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm">
          <span className="text-slate-500">Color</span>
          <input type="color" value={button.color} onChange={(event) => onChange({ ...button, color: event.target.value })} className="h-7 w-10" />
        </label>
        {showIcon && <select className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand-400" value={button.icon} onChange={(event) => onChange({ ...button, icon: event.target.value as EditableButton['icon'] })}>
          <option value="arrow">Arrow icon</option>
          <option value="phone">Phone icon</option>
          <option value="none">No icon</option>
        </select>}
      </div>
    </div>
  )
}

function TextControl({
  label,
  value,
  multiline = false,
  onChange,
}: {
  label: string
  value: string
  multiline?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          rows={4}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
      )}
    </label>
  )
}

function ImageControl({
  label,
  image,
  sectionId,
  onChange,
}: {
  label: string
  image: EditableImage
  sectionId: string
  onChange: (image: EditableImage) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const imageUrl = await uploadHomepageImage(file, sectionId)
      onChange({ ...image, src: imageUrl })
    } catch (uploadError) {
      window.alert(uploadError instanceof Error ? uploadError.message : 'Could not upload image.')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="border-b border-slate-200/70 pb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-50 px-3 text-xs font-bold text-brand-700 hover:bg-brand-100"
        >
          {isUploading ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
          Change
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
        <img src={image.src} alt={image.alt} className="h-32 w-full object-cover" />
      </div>
      <TextControl label="Alt text" value={image.alt} onChange={(alt) => onChange({ ...image, alt })} />
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
    </div>
  )
}

function IconControl({
  label,
  icon,
  sectionId,
  onChange,
  fallback,
}: {
  label: string
  icon?: EditableImage
  sectionId: string
  onChange: (image: EditableImage) => void
  fallback?: React.ReactNode
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const iconUrl = await uploadHomepageImage(file, sectionId)
      onChange({ src: iconUrl, alt: icon?.alt || label })
    } catch (uploadError) {
      window.alert(uploadError instanceof Error ? uploadError.message : 'Could not upload icon.')
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="border-b border-slate-200/70 pb-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{label}</h3>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-brand-50 px-3 text-xs font-bold text-brand-700 hover:bg-brand-100"
        >
          {isUploading ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
          Upload
        </button>
      </div>
      <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-500 text-2xl text-white shadow-[0_12px_28px_rgba(251,119,13,0.22)]">
        {icon?.src ? <img src={icon.src} alt={icon.alt} className="h-8 w-8 object-contain" /> : fallback}
      </div>
      <input ref={inputRef} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" onChange={handleFileChange} className="hidden" />
    </div>
  )
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200/70 pb-5">
      <h3 className="mb-4 text-sm font-bold text-slate-900">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function GallerySlider({ images }: { images: EditableImage[] }) {
  const baseImages = useMemo(() => images.length > 0 ? images : [lockedHeroBackground], [images])
  const slideCount = baseImages.length
  const slides = useMemo(() => [...baseImages, ...baseImages, ...baseImages], [baseImages])
  const [index, setIndex] = useState(slideCount)
  const [isTransitioning, setIsTransitioning] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const resetTimer = useRef<number | null>(null)

  const activeIndex = ((index % slideCount) + slideCount) % slideCount

  const move = (direction: number) => {
    setIsTransitioning(true)
    setIndex((current) => current + direction)
  }

  const goTo = (nextIndex: number) => {
    setIsTransitioning(true)
    setIndex(slideCount + nextIndex)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setIndex(slideCount), 0)
    return () => window.clearTimeout(timer)
  }, [slideCount])

  useEffect(() => {
    if (isPaused || slideCount < 2) return undefined

    const timer = window.setInterval(() => {
      move(1)
    }, 3000)

    return () => {
      window.clearInterval(timer)
      if (resetTimer.current) window.clearTimeout(resetTimer.current)
    }
  }, [isPaused, slideCount])

  const resetLoopPosition = (nextIndex: number) => {
    setIsTransitioning(false)
    setIndex(nextIndex)

    if (resetTimer.current) window.clearTimeout(resetTimer.current)
    resetTimer.current = window.setTimeout(() => {
      setIsTransitioning(true)
    }, 50)
  }

  const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.propertyName !== 'transform') return

    if (index >= slideCount * 2) {
      resetLoopPosition(index - slideCount)
    }

    if (index < slideCount) {
      resetLoopPosition(index + slideCount)
    }
  }

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || slideCount < 2) return
    event.preventDefault()
    dragStartX.current = event.clientX
    setDragOffset(0)
    setIsDragging(true)
    setIsPaused(true)
    setIsTransitioning(false)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return
    setDragOffset(event.clientX - dragStartX.current)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return

    const viewportWidth = viewportRef.current?.clientWidth ?? 1
    const slidesPerView = window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1
    const slideWidth = viewportWidth / slidesPerView
    const dragDistance = event.clientX - dragStartX.current
    const dragThreshold = slideWidth * 0.14
    const slideDelta = Math.abs(dragDistance) > dragThreshold
      ? Math.max(-3, Math.min(3, Math.sign(-dragDistance) * Math.max(1, Math.round(Math.abs(dragDistance) / slideWidth))))
      : 0

    setIsDragging(false)
    setDragOffset(0)
    setIsTransitioning(true)
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (slideDelta !== 0) {
      setIndex((current) => current + slideDelta)
    }
  }

  return (
    <div className="relative" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
      <div
        ref={viewportRef}
        className={`overflow-hidden rounded-[1.75rem] bg-transparent select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className={`flex [--slides-per-view:1] md:[--slides-per-view:2] lg:[--slides-per-view:3] ${
            isTransitioning ? 'transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''
          }`}
          style={{
            touchAction: 'pan-y',
            transform: `translateX(calc(-${index} * 100% / var(--slides-per-view) + ${dragOffset}px))`,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {slides.map((image, slideIndex) => (
            <div key={`${image.src}-${slideIndex}`} className="shrink-0 basis-full bg-transparent px-0 md:basis-1/2 md:px-2.5 lg:basis-1/3">
              <img className="h-80 w-full rounded-[1.75rem] object-cover pointer-events-none" src={image.src} alt={image.alt || `Gallery image ${activeIndex + 1}`} draggable="false" />
            </div>
          ))}
        </div>
      </div>
      {slideCount > 1 ? (
        <>
          <button className="absolute left-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-500 shadow-xl transition hover:bg-[#25424C] hover:text-white" type="button" aria-label="Previous gallery image" onClick={() => move(-1)}>
            <FiArrowLeft />
          </button>
          <button className="absolute right-3 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-500 shadow-xl transition hover:bg-[#25424C] hover:text-white" type="button" aria-label="Next gallery image" onClick={() => move(1)}>
            <FiArrowRight />
          </button>
          <div className="mt-6 flex justify-center gap-2">
            {baseImages.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                aria-label={`Go to gallery slide ${dotIndex + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${dotIndex === activeIndex ? 'w-7 bg-brand-500' : 'w-2.5 bg-slate-300'}`}
                onClick={() => goTo(dotIndex)}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function CustomizePage() {
  const [content, setContent] = useState<HomeCustomizationContent>(() => withLockedHeroBackground(defaultHomeCustomization))
  const [publishedContent, setPublishedContent] = useState<HomeCustomizationContent>(() => withLockedHeroBackground(defaultHomeCustomization))
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const [activeElement, setActiveElement] = useState<ActiveElement>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(true)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [heroAccess, setHeroAccess] = useState<{ allowed: boolean; error?: string }>({ allowed: false })
  const [heroPreviewId, setHeroPreviewId] = useState('')
  const [tourPackages, setTourPackages] = useState<TourPackage[]>([])
  const [arePackagesLoading, setArePackagesLoading] = useState(true)
  const [packagesError, setPackagesError] = useState('')
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false)
  const [galleryDraftImages, setGalleryDraftImages] = useState<GalleryDraftImage[]>([])
  const [isImportingGallery, setIsImportingGallery] = useState(false)
  const [galleryUploadIndex, setGalleryUploadIndex] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [isPublishToastVisible, setIsPublishToastVisible] = useState(false)
  const [publishToastKey, setPublishToastKey] = useState(0)
  const [error, setError] = useState('')

  const visibleSectionOrder = useMemo(
    () => content.sectionOrder.filter((sectionId) => !content.hiddenSections.includes(sectionId)),
    [content.hiddenSections, content.sectionOrder],
  )

  const featuredTourPackages = useMemo(() => {
    const publishedPackages = tourPackages.filter((tourPackage) => tourPackage.status === 'published')
    return (publishedPackages.length > 0 ? publishedPackages : tourPackages).slice(0, 6)
  }, [tourPackages])

  const hasPublishChanges = useMemo(
    () => getContentFingerprint(content) !== getContentFingerprint(publishedContent),
    [content, publishedContent],
  )

  useEffect(() => {
    let isMounted = true

    async function loadCustomization() {
      setIsLoading(true)
      setError('')

      try {
        const result = await getHomepageCustomization()
        if (!isMounted) return

        setContent(withLockedHeroBackground(result.draft))
        setPublishedContent(withLockedHeroBackground(result.published))
        setHeroAccess(result.heroState)
      } catch (loadError) {
        if (!isMounted) return
        setError(loadError instanceof Error ? loadError.message : 'Unable to load homepage customization.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadCustomization()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (publishToastKey === 0) return undefined

    const showTimer = window.setTimeout(() => setIsPublishToastVisible(true), 0)
    const hideTimer = window.setTimeout(() => {
      setIsPublishToastVisible(false)
    }, 3600)

    return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer) }
  }, [publishToastKey])

  useEffect(() => {
    let isMounted = true

    async function loadPackages() {
      setArePackagesLoading(true)
      setPackagesError('')

      try {
        const packages = await getPackages()
        if (isMounted) setTourPackages(packages)
      } catch (loadPackagesError) {
        if (isMounted) {
          setPackagesError(loadPackagesError instanceof Error ? loadPackagesError.message : 'Unable to load tour packages.')
        }
      } finally {
        if (isMounted) setArePackagesLoading(false)
      }
    }

    void loadPackages()

    return () => {
      isMounted = false
    }
  }, [])

  const updatePath = (path: string, value: unknown) => {
    setContent((current) => setByPath(current, path, value))
    setNotice('')
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)
    setError('')
    setNotice('')

    try {
      const draftContent = withLockedHeroBackground(content)
      const result = await saveHomepageDraft(draftContent)
      setContent(draftContent)
      setNotice('Draft saved.' + ('elementSyncWarning' in result && result.elementSyncWarning ? ' The supplementary element index could not refresh; save again to retry.' : '') + ('cleanupWarning' in result && result.cleanupWarning ? ' Some unused image files could not be removed.' : ''))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save draft.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleHeroChange = async (heroSlider: HeroSliderContent) => {
    const next = withLockedHeroBackground({ ...content, heroSlider })
    setIsSaving(true)
    setError('')
    try {
      const result = await saveHomepageDraft(next)
      setContent(next)
      setNotice('Hero changes saved to draft. Publish to update the website.' + ('cleanupWarning' in result && result.cleanupWarning ? ' Some unused image files could not be removed; the saved slides are safe.' : '') + ('elementSyncWarning' in result && result.elementSyncWarning ? ' The supplementary element index could not refresh; Save Draft will retry.' : ''))
    } catch {
      throw new Error('Unable to save hero changes. Please try again.')
    } finally { setIsSaving(false) }
  }

  const handlePublish = async () => {
    if (!hasPublishChanges) return

    setIsPublishing(true)
    setError('')
    setNotice('')

    try {
      const publishedContent = withLockedHeroBackground(content)
      const result = await publishHomepageCustomization(publishedContent)
      setContent(publishedContent)
      setPublishedContent(publishedContent)
      setPublishToastKey((current) => current + 1)
      if ('cleanupWarning' in result && result.cleanupWarning) setNotice('Published successfully. Some unused image files could not be removed.')
      if ('elementSyncWarning' in result && result.elementSyncWarning) setNotice('Published successfully. The supplementary element index could not refresh; Save Draft will retry the draft index.')
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to publish homepage.')
    } finally {
      setIsPublishing(false)
    }
  }

  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setContent((current) => {
      const nextOrder = [...current.sectionOrder]
      const index = nextOrder.indexOf(sectionId)
      const targetIndex = index + direction

      if (index < 0 || targetIndex < 0 || targetIndex >= nextOrder.length) return current

      const [item] = nextOrder.splice(index, 1)
      nextOrder.splice(targetIndex, 0, item)
      return { ...current, sectionOrder: nextOrder }
    })
  }

  const toggleSectionHidden = (sectionId: string) => {
    if (sectionId === 'featuredTours') return
    setContent((current) => ({
      ...current,
      hiddenSections: current.hiddenSections.includes(sectionId)
        ? current.hiddenSections.filter((item) => item !== sectionId)
        : [...current.hiddenSections, sectionId],
    }))
  }

  const duplicateSection = (sectionId: string) => {
    if (sectionId === 'featuredTours') return
    const duplicateId = `${sectionId}-${createId('copy')}`
    setContent((current) => ({
      ...current,
      sectionOrder: [...current.sectionOrder, duplicateId],
    }))
    setNotice('Section duplicated in layout metadata. Use this as a marker for a follow-up content section.')
  }

  const resetDraft = () => {
    const reset = withLockedHeroBackground(mergeHomeCustomization(publishedContent))
    // An unpublished hero draft must also be reset when no hero snapshot has
    // ever been published. Keep an explicit snapshot so Save Draft persists it.
    if (content.heroSlider && !reset.heroSlider) reset.heroSlider = legacyHeroSlider(reset.hero)
    setContent(reset)
    setNotice('Draft reset to current published content.')
  }

  const closeGalleryModal = () => {
    galleryDraftImages.forEach((image) => URL.revokeObjectURL(image.previewUrl))
    setGalleryDraftImages([])
    setIsGalleryModalOpen(false)
    setIsImportingGallery(false)
  }

  const handleGalleryDraftSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return

    const remainingSlots = Math.max(10 - galleryDraftImages.length, 0)
    const selectedFiles = files.slice(0, remainingSlots)

    if (files.length > remainingSlots) {
      window.alert('You can import up to 10 gallery images at a time.')
    }

    setGalleryDraftImages((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: createId('gallery-draft'),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ])
  }

  const moveGalleryDraftImage = (index: number, direction: -1 | 1) => {
    setGalleryDraftImages((current) => {
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= current.length) return current
      const next = [...current]
      const [item] = next.splice(index, 1)
      next.splice(targetIndex, 0, item)
      return next
    })
  }

  const removeGalleryDraftImage = (id: string) => {
    setGalleryDraftImages((current) => {
      const removed = current.find((image) => image.id === id)
      if (removed) URL.revokeObjectURL(removed.previewUrl)
      return current.filter((image) => image.id !== id)
    })
  }

  const importGalleryDraftImages = async () => {
    if (galleryDraftImages.length === 0) return

    setIsImportingGallery(true)
    setError('')

    try {
      const importedImages = await Promise.all(
        galleryDraftImages.map(async (image, index) => ({
          src: await uploadHomepageImage(image.file, `gallery-${index}`),
          alt: image.file.name.replace(/\.[^.]+$/, '') || `Gallery image ${index + 1}`,
        })),
      )
      updatePath('gallery.images', importedImages)
      closeGalleryModal()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Unable to import gallery images.')
      setIsImportingGallery(false)
    }
  }

  const replaceGalleryImage = async (index: number, file: File | undefined) => {
    if (!file) return

    setGalleryUploadIndex(index)
    setError('')

    try {
      const imageUrl = await uploadHomepageImage(file, `gallery-${index}`)
      updatePath(`gallery.images.${index}`, {
        src: imageUrl,
        alt: file.name.replace(/\.[^.]+$/, '') || `Gallery image ${index + 1}`,
      })
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : 'Unable to replace gallery image.')
    } finally {
      setGalleryUploadIndex(null)
    }
  }

  const removeGalleryImage = (index: number) => {
    updatePath('gallery.images', content.gallery.images.filter((_, imageIndex) => imageIndex !== index))
  }

  const renderButtonPreview = (button: EditableButton) => (
    <span className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-black uppercase tracking-[0.1em] text-white shadow-sm" style={{ backgroundColor: button.color }}>
      {button.text} {button.icon === 'arrow' ? <FiArrowRight /> : null}
    </span>
  )

  const sectionRingClass = (sectionId: string) => (
    sectionId === activeSection && activeElement ? 'ring-2 ring-blue-500' : ''
  )

  const sectionControls = (sectionId: string) => (
    <div className="absolute right-3 top-3 z-20 hidden items-center gap-1 rounded-full bg-white/95 p-1 shadow-xl group-hover/section:flex" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-slate-100" onClick={() => moveSection(sectionId, -1)} title="Move up"><FiArrowUp /></button>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-slate-100" onClick={() => moveSection(sectionId, 1)} title="Move down"><FiArrowDown /></button>
      <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-slate-100" onClick={() => duplicateSection(sectionId)} title="Duplicate section"><FiPlus /></button>
      {sectionId !== 'featuredTours' ? (
        <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-slate-700 hover:bg-red-50 hover:text-red-600" onClick={() => toggleSectionHidden(sectionId)} title="Hide section"><FiEyeOff /></button>
      ) : null}
    </div>
  )

  const selectSignatureItem = (index: number) => {
    setActiveSection('signature')
    setActiveElement({ type: 'signatureItem', index })
    setIsEditorOpen(true)
  }

  const selectElement = (sectionId: SectionId, element: ActiveElement) => {
    setActiveSection(sectionId)
    setActiveElement(element)
    setIsEditorOpen(true)
  }

  const renderSection = (sectionId: string) => {
    if (sectionId.startsWith('hero')) {
      const previewSlides = (content.heroSlider ?? legacyHeroSlider(content.hero)).slides
      const previewSlide = previewSlides.find(slide => slide.id === heroPreviewId) ?? previewSlides[0]
      if (previewSlide) return (
        <section key={sectionId} className={`group/section relative ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <HeroSlidePreview slide={previewSlide} large />
          <button type="button" className="absolute bottom-4 right-4 rounded-xl bg-brand-500 px-4 py-2 text-sm font-bold text-white" onClick={() => selectElement('hero', { type: 'heroContent' })}>Manage Hero Slides</button>
        </section>
      )
      return (
        <section key={sectionId} className={`group/section relative min-h-[92vh] overflow-hidden bg-[#171719] text-white ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <img className="absolute inset-0 h-full w-full object-cover" src={lockedHeroBackground.src} alt={lockedHeroBackground.alt} />
          <div className="absolute inset-0 bg-[#171719]/20" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent via-[#171719]/70 to-[#171719]" />
          <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-6xl flex-col items-center justify-center px-6 pb-24 pt-40 text-center">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                selectElement('hero', { type: 'heroContent' })
              }}
              className={`mx-auto block rounded-2xl px-4 py-3 text-center outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                activeElement?.type === 'heroContent' ? 'ring-2 ring-brand-300' : ''
              }`}
            >
            <span className="block text-3xl font-light italic leading-none text-white/95 md:text-4xl">{content.hero.kicker}</span>
            <span className="mx-auto mt-1 block max-w-5xl text-4xl font-bold leading-tight md:text-7xl">{content.hero.title}</span>
            <span className="mx-auto mt-5 block max-w-2xl text-base leading-8 text-white/80 md:text-lg">{content.hero.subtitle}</span>
            <div className="mt-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-white px-7 py-4 text-xs font-black uppercase tracking-[0.12em] text-white transition">
                {content.hero.cta.text} {content.hero.cta.icon === 'arrow' ? <FiArrowRight /> : null}
              </span>
            </div>
            </button>
          </div>
        </section>
      )
    }

    if (sectionId === 'story') {
      return (
        <section key={sectionId} className={`group/section relative bg-[#171719] px-6 pb-20 pt-8 text-center text-white md:pb-28 md:pt-12 ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto mb-14 flex w-full max-w-xl items-center justify-center gap-5 px-4 md:mb-16 md:gap-7">
              {content.story.badges.slice(0, 4).map((item, index) => (
                <button
                  key={`${item.alt}-${index}`}
                  type="button"
                  className={`grid h-14 w-14 place-items-center rounded-full bg-white shadow-[0_14px_34px_rgba(0,0,0,0.22)] outline-none transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.28)] hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 md:h-16 md:w-16 ${
                    activeElement?.type === 'storyBadge' && activeElement.index === index ? 'ring-2 ring-brand-300' : ''
                  }`}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectElement('story', { type: 'storyBadge', index })
                  }}
                >
                  <img className="max-h-10 w-auto object-contain md:max-h-11" src={item.src} alt={item.alt} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                selectElement('story', { type: 'storyContent' })
              }}
              className={`mx-auto block max-w-5xl rounded-xl px-3 py-2 text-center outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                activeElement?.type === 'storyContent' ? 'ring-2 ring-brand-300' : ''
              }`}
            >
              <span className="block text-2xl italic leading-none md:text-3xl">{content.story.label}</span>
              <span className="mx-auto mt-1 block max-w-4xl text-xl font-black leading-tight md:text-3xl">{content.story.title}</span>
              <span className="mx-auto mt-8 block max-w-4xl space-y-6 text-base leading-7 text-white md:text-lg md:leading-7">
                {content.story.paragraphs.map((paragraph, index) => (
                  <span key={index} className="block">{paragraph}</span>
                ))}
              </span>
            </button>
          </div>
        </section>
      )
    }

    if (sectionId === 'signature') {
      return (
        <section key={sectionId} className={`group/section relative bg-[#faf7f2] px-6 py-20 ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.95fr_1.25fr] lg:items-stretch">
            <ImageEditor
              image={content.signature.image}
              sectionId="signature"
              onChange={(image) => updatePath('signature.image', image)}
              isSelected={activeElement?.type === 'signatureImage'}
              onSelect={() => selectElement('signature', { type: 'signatureImage' })}
              className="h-full min-h-[24rem] rounded-[1.75rem] bg-slate-200 shadow-[0_22px_55px_rgba(37,66,76,0.14)]"
            >
              <img className="h-full min-h-[24rem] w-full rounded-[inherit] object-cover" src={content.signature.image.src} alt={content.signature.image.alt} />
              <div className="absolute bottom-6 right-6 text-right text-white drop-shadow">
                <p className="text-2xl font-black leading-tight md:text-4xl">{content.signature.founderName}</p>
                <p className="text-lg font-light leading-tight md:text-2xl">{content.signature.founderRole}</p>
              </div>
            </ImageEditor>
            <div className="flex h-full flex-col">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  selectElement('signature', { type: 'signatureContent' })
                }}
                className={`block max-w-4xl rounded-xl px-2 py-2 text-left outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                  activeElement?.type === 'signatureContent' ? 'ring-2 ring-brand-300' : ''
                }`}
              >
                <span className="block text-2xl italic leading-none text-[#25424C] md:text-3xl">{content.signature.title}</span>
                <span className="mt-5 block max-w-3xl text-base leading-7 text-slate-500">{content.signature.description}</span>
              </button>
              <div className="mt-9 grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-3">
                {content.signature.items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      selectSignatureItem(index)
                    }}
                    className={`group/item border-t px-1 py-4 text-left transition hover:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300 sm:py-5 ${
                      activeElement?.type === 'signatureItem' && activeElement.index === index ? 'border-brand-500 ring-2 ring-brand-300' : 'border-[#ded2c4]'
                    }`}
                  >
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-500 text-base text-white shadow-[0_12px_28px_rgba(251,119,13,0.22)] sm:h-11 sm:w-11 sm:text-lg">
                        {item.icon?.src ? (
                          <img src={item.icon.src} alt={item.icon.alt} className="h-5 w-5 object-contain" />
                        ) : (
                          (() => {
                            const Icon = signatureFallbackIcons[index] ?? FiMapPin
                            return <Icon />
                          })()
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black leading-snug text-[#25424C] sm:text-base">{item.title}</span>
                        <span className="mt-2 block text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">{item.text}</span>
                      </span>
                    </div>
                    <span className="mt-4 block h-px w-10 bg-brand-500/40 transition group-hover/item:w-16" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )
    }

    if (sectionId === 'featuredTours') {
      return (
        <section key={sectionId} className={`group/section relative bg-white px-6 py-20 ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <div className="mx-auto max-w-6xl">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                selectElement('featuredTours', { type: 'featuredToursContent' })
              }}
              className={`mx-auto block max-w-3xl rounded-xl px-3 py-2 text-center outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                activeElement?.type === 'featuredToursContent' ? 'ring-2 ring-brand-300' : ''
              }`}
            >
              <p className="text-2xl italic text-[#25424C]">{content.featuredTours.label}</p>
              <h2 className="mt-1 text-3xl font-black text-[#25424C]">{content.featuredTours.title}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-500">{content.featuredTours.description}</p>
            </button>

            {packagesError ? (
              <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm font-semibold text-red-700">
                {packagesError}
              </div>
            ) : null}

            {arePackagesLoading ? (
              <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-[1.75rem] bg-white shadow-xl shadow-slate-200/70">
                    <div className="h-48 animate-pulse bg-slate-200" />
                    <div className="space-y-4 p-6">
                      <div className="h-5 w-3/4 animate-pulse rounded bg-slate-200" />
                      <div className="h-16 animate-pulse rounded bg-slate-100" />
                      <div className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredTourPackages.length > 0 ? (
              <>
                <div className="mt-12 grid gap-x-6 gap-y-9 md:grid-cols-2 xl:grid-cols-3">
                  {featuredTourPackages.map((tourPackage) => (
                    <Link
                      key={tourPackage.id}
                      to={`/packages/${tourPackage.id}/edit`}
                      onClick={(event) => event.stopPropagation()}
                      className="group/card relative flex min-h-[390px] flex-col overflow-hidden rounded-[1.75rem] bg-white text-left shadow-xl shadow-slate-200/80 transition hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/80"
                    >
                      <div className="relative h-48 overflow-hidden bg-slate-200">
                        <img
                          src={getPackageImage(tourPackage)}
                          alt={tourPackage.title}
                          className="h-full w-full object-cover transition duration-500 group-hover/card:scale-105"
                        />
                        <span className="absolute -bottom-3 left-4 rounded-full bg-[#25424C] px-3 py-1.5 text-xs font-black text-white shadow-lg">
                          {formatPackagePrice(tourPackage.price_from_usd)}
                        </span>
                        {tourPackage.status !== 'published' ? (
                          <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.08em] text-slate-700 shadow">
                            {tourPackage.status}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col p-6 pt-8">
                        <h3 className="text-xl font-semibold leading-7 text-[#25424C]">{tourPackage.title}</h3>
                        <p className="mt-6 flex-1 text-sm font-medium leading-6 text-slate-500">
                          {truncateText(tourPackage.short_description || tourPackage.overview, 118)}
                        </p>
                        <div className="mt-6 flex items-center justify-between gap-4">
                          <span className="inline-flex items-center gap-2 rounded-full border border-brand-500 px-4 py-2 text-[0.65rem] font-black uppercase tracking-[0.08em] text-brand-600 transition group-hover/card:bg-brand-500 group-hover/card:text-white">
                            Edit package <FiArrowRight />
                          </span>
                          <span className="shrink-0 text-xs font-black text-[#25424C]">
                            {tourPackage.duration_days} Day{tourPackage.duration_days === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-10 text-center">
                  <Link
                    to="/packages"
                    onClick={(event) => event.stopPropagation()}
                    className="inline-flex items-center gap-2 rounded-full border border-[#25424C] px-6 py-3 text-xs font-black uppercase tracking-[0.08em] text-[#25424C] transition hover:bg-[#25424C] hover:text-white"
                  >
                    View all tours <FiArrowRight />
                  </Link>
                </div>
              </>
            ) : (
              <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-brand-200 bg-brand-50/70 px-6 py-10 text-center">
                <h3 className="text-xl font-black text-slate-900">No tour packages yet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">Create packages in the tour packages dashboard and they will appear here automatically.</p>
                <Link
                  to="/packages/new"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-3 text-xs font-black uppercase tracking-[0.08em] text-white hover:bg-brand-600"
                >
                  Add package <FiArrowRight />
                </Link>
              </div>
            )}
          </div>
        </section>
      )
    }

    if (sectionId === 'journey') {
      return (
        <section key={sectionId} className={`group/section relative bg-[#fffaf5] px-6 py-20 ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <ImageEditor
              image={content.journey.image}
              sectionId="journey"
              onChange={(image) => updatePath('journey.image', image)}
              isSelected={activeElement?.type === 'journeyMedia'}
              onSelect={() => selectElement('journey', { type: 'journeyMedia' })}
              className="aspect-[4/3] overflow-visible rounded-[1.75rem] bg-slate-200 shadow-xl"
            >
              <img className="h-full w-full object-cover" src={content.journey.image.src} alt={content.journey.image.alt} />
              <div className="absolute -bottom-5 right-4 hidden w-44 overflow-hidden rounded-2xl border-4 border-[#fffaf5] shadow-[0_20px_45px_rgba(37,66,76,0.18)] sm:block">
                <img className="h-32 w-full object-cover" src={content.journey.thumbnail.src} alt={content.journey.thumbnail.alt} />
              </div>
            </ImageEditor>
            <div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  selectElement('journey', { type: 'journeyContent' })
                }}
                className={`block rounded-xl px-2 py-2 text-left outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                  activeElement?.type === 'journeyContent' ? 'ring-2 ring-brand-300' : ''
                }`}
              >
                <span className="block text-3xl italic text-slate-900">{content.journey.label}</span>
                <span className="mt-2 block text-3xl font-black text-slate-900">{content.journey.title}</span>
                <span className="mt-5 block text-lg leading-8 text-slate-600">{content.journey.description}</span>
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  selectElement('journey', { type: 'journeyButton' })
                }}
                className={`mt-8 rounded-full outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                  activeElement?.type === 'journeyButton' ? 'ring-2 ring-brand-300' : ''
                }`}
              >
                {renderButtonPreview(content.journey.cta)}
              </button>
            </div>
          </div>
        </section>
      )
    }

    if (sectionId === 'why') {
      return (
        <section key={sectionId} className={`group/section relative bg-[#25424C] px-6 py-20 text-white ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <div className="mx-auto max-w-6xl text-center">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                selectElement('why', { type: 'whyContent' })
              }}
              className={`mx-auto block max-w-5xl rounded-xl px-3 py-2 text-center outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                activeElement?.type === 'whyContent' ? 'ring-2 ring-brand-300' : ''
              }`}
            >
              <span className="block text-3xl italic">{content.why.label}</span>
              <span className="mt-2 block text-3xl font-black">{content.why.title}</span>
              <span className="mx-auto mt-5 block max-w-3xl leading-8 text-white/70">{content.why.description}</span>
            </button>
            <div className="mt-12 grid grid-cols-2 gap-5 lg:grid-cols-4">
              {content.why.cards.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    selectElement('why', { type: 'whyCard', index })
                  }}
                  className={`rounded-3xl border border-white/10 bg-white/[0.04] px-3 py-6 text-center outline-none transition hover:border-brand-300 hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 sm:px-6 sm:py-8 ${
                    activeElement?.type === 'whyCard' && activeElement.index === index ? 'ring-2 ring-brand-300' : ''
                  }`}
                >
                  <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-500 text-xl text-[#25424C] sm:h-16 sm:w-16 sm:text-2xl">
                    {card.icon?.src ? (
                      <img src={card.icon.src} alt={card.icon.alt} className="h-7 w-7 object-contain" />
                    ) : (
                      (() => {
                        const Icon = whyFallbackIcons[index] ?? FiCompass
                        return <Icon />
                      })()
                    )}
                  </span>
                  <span className="mt-5 block text-sm font-black text-white sm:text-lg">{card.title}</span>
                  <span className="mx-auto mt-3 block max-w-60 text-sm leading-6 text-white/70 sm:text-base sm:leading-7">{card.text}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )
    }

    if (sectionId === 'gallery') {
      return (
        <section
          key={sectionId}
          className={`group/section relative bg-[#faf7f2] px-6 py-20 ${sectionRingClass(sectionId)}`}
          onClick={() => selectElement('gallery', { type: 'galleryImages' })}
        >
          {sectionControls(sectionId)}
          <div className="mx-auto max-w-6xl text-center">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                selectElement('gallery', { type: 'galleryContent' })
              }}
              className={`mx-auto block max-w-4xl rounded-2xl px-4 py-3 text-center outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
                activeElement?.type === 'galleryContent' ? 'ring-2 ring-brand-300' : ''
              }`}
            >
              <span className="block text-3xl italic text-slate-900">{content.gallery.label}</span>
              <span className="mt-2 block text-3xl font-black text-slate-900">{content.gallery.title}</span>
              <span className="mx-auto mt-3 block max-w-3xl text-slate-600">{content.gallery.description}</span>
            </button>
            <div
              className={`mt-10 rounded-[1.75rem] outline-none transition hover:ring-2 hover:ring-brand-300 ${
                activeElement?.type === 'galleryImages' ? 'ring-2 ring-brand-300' : ''
              }`}
            >
              <GallerySlider images={content.gallery.images} />
            </div>
          </div>
        </section>
      )
    }

    if (sectionId === 'reviews') {
      return (
        <section key={sectionId} className={`group/section relative bg-white px-6 py-20 text-center ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <button
            type="button"
            onClick={() => selectElement('reviews', { type: 'reviewsContent' })}
            className={`mx-auto block max-w-4xl rounded-2xl px-4 py-3 text-center outline-none transition hover:ring-2 hover:ring-brand-300 focus:ring-2 focus:ring-brand-300 ${
              activeElement?.type === 'reviewsContent' ? 'ring-2 ring-brand-300' : ''
            }`}
          >
            <span className="block text-3xl font-black text-slate-900">{content.reviews.title}</span>
            <span className="mt-3 block text-slate-600">{content.reviews.description}</span>
          </button>
          <div className="mx-auto mt-8 h-28 max-w-4xl rounded-2xl bg-slate-100 p-5 text-sm text-slate-500">Review cards remain powered by the public review component.</div>
        </section>
      )
    }

    if (sectionId === 'footerBand') {
      return (
        <section key={sectionId} className={`group/section relative ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <ImageEditor image={content.footerBand} sectionId="footer-band" onChange={(image) => updatePath('footerBand', image)} className="h-[420px] bg-slate-200">
            <img className="h-full w-full object-cover" src={content.footerBand.src} alt={content.footerBand.alt} />
          </ImageEditor>
        </section>
      )
    }

    if (sectionId === 'footer') {
      return (
        <section key={sectionId} className={`group/section relative bg-[#25424C] px-6 py-14 text-white ${sectionRingClass(sectionId)}`}>
          {sectionControls(sectionId)}
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-4">
            <div>
              <h3 className="font-black text-brand-400">Top Cloud Rwenzori Adventures</h3>
              <p className="mt-4 text-sm leading-7 text-white/70"><EditableField multiline label="Footer about" value={content.footer.about} onChange={(value) => updatePath('footer.about', value)} /></p>
            </div>
            <div>
              <h3 className="font-black">Contact Us</h3>
              <p className="mt-4 text-sm"><EditableField label="Footer phone" value={content.footer.phone} onChange={(value) => updatePath('footer.phone', value)} /></p>
              <p className="mt-2 text-sm"><EditableField label="Footer email" value={content.footer.email} onChange={(value) => updatePath('footer.email', value)} /></p>
              <p className="mt-2 text-sm"><EditableField label="Footer location" value={content.footer.location} onChange={(value) => updatePath('footer.location', value)} /></p>
            </div>
            <div>
              <h3 className="font-black">Quick Links</h3>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {content.footer.quickLinks.map((link) => <li key={link.id}>{link.label}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-black">Social</h3>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {content.footer.socials.map((link) => <li key={link.id}>{link.label}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )
    }

    return null
  }

  const activeSectionLabel = activeSection === 'nav' ? 'Header' : activeSection === 'hero'
    ? 'Hero Slides'
    : activeElement?.type === 'signatureItem'
      ? content.signature.items[activeElement.index]?.title ?? 'Signature item'
      : activeElement?.type === 'signatureImage'
      ? 'Founder image'
      : activeElement?.type === 'signatureContent'
        ? 'Signature content'
        : activeElement?.type === 'storyBadge'
          ? `Brand image ${activeElement.index + 1}`
          : activeElement?.type === 'storyContent'
            ? 'Story content'
    : activeElement?.type === 'featuredToursContent'
      ? 'Tours heading'
      : activeElement?.type === 'journeyMedia'
        ? 'Journey media'
      : activeElement?.type === 'journeyContent'
        ? 'Journey content'
        : activeElement?.type === 'journeyButton'
          ? 'Journey button'
          : activeElement?.type === 'whyContent'
            ? 'Why Travel content'
            : activeElement?.type === 'whyCard'
              ? content.why.cards[activeElement.index]?.title ?? 'Why card'
              : activeElement?.type === 'galleryContent'
                ? 'Gallery content'
                : activeElement?.type === 'galleryImages'
                  ? 'Gallery images'
                  : activeElement?.type === 'reviewsContent'
                    ? 'Reviews content'
    : activeSection
      ? editableSections.find((section) => section.id === activeSection)?.label ?? 'Section'
      : 'Select element to edit'

  const renderActiveSectionPanel = () => {
    if (!activeSection) {
      return null
    }

    if (activeSection === 'nav') return (
      <div className="space-y-5">
        <ImageControl label="Header logo" image={content.nav.logo} sectionId="header-logo" onChange={image => updatePath('nav.logo', image)} />
        <LinkEditor title="Navigation" links={content.nav.links} onChange={links => updatePath('nav.links', links)} />
        <ButtonEditor label="Header CTA" button={content.nav.inquiryButton} showIcon={false} onChange={button => updatePath('nav.inquiryButton', button)} />
        <p className="text-sm text-slate-500">Use #inquiry to open the inquiry form, or enter a page path or external URL. Save Draft keeps changes private; Publish makes them live.</p>
      </div>
    )

    if (activeSection === 'hero') return <HeroSlidesManager value={content.heroSlider} legacyHero={content.hero} allowed={heroAccess.allowed} accessError={heroAccess.error} disabled={isLoading || isSaving || isPublishing} onChange={handleHeroChange} onPreview={setHeroPreviewId} />

    if (activeElement?.type === 'storyBadge') {
      const badge = content.story.badges[activeElement.index]

      if (!badge) return null

      return (
        <div className="space-y-4">
          <ImageControl
            label={`Brand image ${activeElement.index + 1}`}
            image={badge}
            sectionId={`story-badge-${activeElement.index}`}
            onChange={(image) => updatePath(`story.badges.${activeElement.index}`, image)}
          />
          <FieldGroup title="Brand link">
            <TextControl label="Link" value={badge.href ?? ''} onChange={(href) => updatePath(`story.badges.${activeElement.index}.href`, href)} />
          </FieldGroup>
        </div>
      )
    }

    if (activeElement?.type === 'storyContent') {
      return (
        <FieldGroup title="Story content">
          <TextControl label="Label" value={content.story.label} onChange={(value) => updatePath('story.label', value)} />
          <TextControl label="Title" value={content.story.title} onChange={(value) => updatePath('story.title', value)} />
          {content.story.paragraphs.map((paragraph, index) => (
            <TextControl key={index} label={`Paragraph ${index + 1}`} value={paragraph} multiline onChange={(value) => updatePath(`story.paragraphs.${index}`, value)} />
          ))}
        </FieldGroup>
      )
    }

    if (activeElement?.type === 'featuredToursContent') {
      return (
        <FieldGroup title="Tours heading">
          <TextControl label="Label" value={content.featuredTours.label} onChange={(value) => updatePath('featuredTours.label', value)} />
          <TextControl label="Title" value={content.featuredTours.title} onChange={(value) => updatePath('featuredTours.title', value)} />
          <TextControl label="Description" value={content.featuredTours.description} multiline onChange={(value) => updatePath('featuredTours.description', value)} />
        </FieldGroup>
      )
    }

    if (activeElement?.type === 'journeyMedia') {
      return (
        <div className="space-y-4">
          <ImageControl label="Journey image" image={content.journey.image} sectionId="journey" onChange={(image) => updatePath('journey.image', image)} />
          <ImageControl label="Floating thumbnail" image={content.journey.thumbnail} sectionId="journey-thumbnail" onChange={(image) => updatePath('journey.thumbnail', image)} />
        </div>
      )
    }

    if (activeElement?.type === 'journeyContent') {
      return (
        <FieldGroup title="Journey content">
          <TextControl label="Label" value={content.journey.label} onChange={(value) => updatePath('journey.label', value)} />
          <TextControl label="Title" value={content.journey.title} onChange={(value) => updatePath('journey.title', value)} />
          <TextControl label="Description" value={content.journey.description} multiline onChange={(value) => updatePath('journey.description', value)} />
        </FieldGroup>
      )
    }

    if (activeElement?.type === 'journeyButton') {
      return (
        <ButtonEditor label="Journey button" button={content.journey.cta} onChange={(button) => updatePath('journey.cta', button)} />
      )
    }

    if (activeElement?.type === 'whyContent') {
      return (
        <FieldGroup title="Why Travel content">
          <TextControl label="Label" value={content.why.label} onChange={(value) => updatePath('why.label', value)} />
          <TextControl label="Title" value={content.why.title} onChange={(value) => updatePath('why.title', value)} />
          <TextControl label="Description" value={content.why.description} multiline onChange={(value) => updatePath('why.description', value)} />
        </FieldGroup>
      )
    }

    if (activeElement?.type === 'whyCard') {
      const card = content.why.cards[activeElement.index]
      const FallbackIcon = whyFallbackIcons[activeElement.index] ?? FiCompass

      if (!card) return null

      return (
        <div className="space-y-4">
          <IconControl
            label="Icon"
            icon={card.icon}
            sectionId={`why-card-${activeElement.index}-icon`}
            fallback={<FallbackIcon />}
            onChange={(icon) => updatePath(`why.cards.${activeElement.index}.icon`, icon)}
          />
          <FieldGroup title="Reason card">
            <TextControl label="Title" value={card.title} onChange={(value) => updatePath(`why.cards.${activeElement.index}.title`, value)} />
            <TextControl label="Description" value={card.text} multiline onChange={(value) => updatePath(`why.cards.${activeElement.index}.text`, value)} />
          </FieldGroup>
        </div>
      )
    }

    if (activeElement?.type === 'galleryContent') {
      return (
        <FieldGroup title="Gallery content">
          <TextControl label="Label" value={content.gallery.label} onChange={(value) => updatePath('gallery.label', value)} />
          <TextControl label="Title" value={content.gallery.title} onChange={(value) => updatePath('gallery.title', value)} />
          <TextControl label="Description" value={content.gallery.description} multiline onChange={(value) => updatePath('gallery.description', value)} />
        </FieldGroup>
      )
    }

    if (activeElement?.type === 'galleryImages') {
      return (
        <FieldGroup title="Gallery images">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm leading-6 text-slate-600">
              {content.gallery.images.length} image{content.gallery.images.length === 1 ? '' : 's'} selected. Import up to 10 images and arrange them before publishing.
            </p>
            <button
              type="button"
              onClick={() => setIsGalleryModalOpen(true)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100"
            >
              <FiUpload /> Select
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {content.gallery.images.map((image, index) => (
              <div key={`${image.src}-${index}`} className="group/thumb overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img src={image.src} alt={image.alt || `Gallery image ${index + 1}`} className="h-24 w-full object-cover" />
                <div className="flex items-center justify-between gap-2 p-2">
                  <span className="text-xs font-bold text-slate-500">#{index + 1}</span>
                  <div className="flex items-center gap-1">
                    <label className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-600 hover:bg-brand-50 hover:text-brand-600" title="Replace image">
                      <FiUpload />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        disabled={galleryUploadIndex !== null}
                        onChange={(event) => {
                          void replaceGalleryImage(index, event.target.files?.[0])
                          event.target.value = ''
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(index)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-red-500 hover:bg-red-50"
                      title="Delete image"
                      disabled={galleryUploadIndex !== null}
                    >
                      {galleryUploadIndex === index ? <FiRefreshCw className="animate-spin" /> : <FiTrash2 />}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FieldGroup>
      )
    }

    if (activeElement?.type === 'reviewsContent') {
      return (
        <FieldGroup title="Reviews content">
          <TextControl label="Title" value={content.reviews.title} onChange={(value) => updatePath('reviews.title', value)} />
          <TextControl label="Description" value={content.reviews.description} onChange={(value) => updatePath('reviews.description', value)} />
        </FieldGroup>
      )
    }

    if (activeSection === 'featuredTours') {
      return (
        <div className="space-y-4">
          <FieldGroup title="Tour packages">
            <p className="text-sm leading-6 text-slate-600">
              Select the Tours heading in the preview to edit its text. Tour cards come from the Tour Packages dashboard; click any card to open its package editor.
            </p>
            <div className="grid gap-2">
              <Link to="/packages" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-brand-50 px-4 text-sm font-bold text-brand-700 hover:bg-brand-100">
                View all packages <FiArrowRight />
              </Link>
              <Link to="/packages/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:border-brand-200 hover:text-brand-600">
                Add package <FiPlus />
              </Link>
            </div>
          </FieldGroup>
        </div>
      )
    }

    if (activeSection === 'story') {
      return (
        <div className="space-y-4">
          <FieldGroup title="Story elements">
            <p className="text-sm leading-6 text-slate-600">
              Select one brand icon to edit its image, alt text, and link. Select the story text block to edit the label, title, and paragraphs together.
            </p>
          </FieldGroup>
        </div>
      )
    }

    if (activeSection === 'signature') {
      if (activeElement?.type === 'signatureImage') {
        return (
          <div className="space-y-4">
            <ImageControl label="Founder image" image={content.signature.image} sectionId="signature" onChange={(image) => updatePath('signature.image', image)} />
            <FieldGroup title="Founder text">
              <TextControl label="Founder name" value={content.signature.founderName} onChange={(value) => updatePath('signature.founderName', value)} />
              <TextControl label="Founder role" value={content.signature.founderRole} onChange={(value) => updatePath('signature.founderRole', value)} />
            </FieldGroup>
          </div>
        )
      }

      if (activeElement?.type === 'signatureContent') {
        return (
          <FieldGroup title="Signature content">
            <TextControl label="Title" value={content.signature.title} onChange={(value) => updatePath('signature.title', value)} />
            <TextControl label="Description" value={content.signature.description} multiline onChange={(value) => updatePath('signature.description', value)} />
          </FieldGroup>
        )
      }

      if (activeElement?.type === 'signatureItem') {
        const item = content.signature.items[activeElement.index]
        const FallbackIcon = signatureFallbackIcons[activeElement.index] ?? FiMapPin

        if (!item) return null

        return (
          <div className="space-y-4">
            <IconControl
              label="Icon"
              icon={item.icon}
              sectionId={`signature-item-${activeElement.index}-icon`}
              fallback={<FallbackIcon />}
              onChange={(icon) => updatePath(`signature.items.${activeElement.index}.icon`, icon)}
            />
            <FieldGroup title="Experience card">
              <TextControl label="Title" value={item.title} onChange={(value) => updatePath(`signature.items.${activeElement.index}.title`, value)} />
              <TextControl label="Description" value={item.text} multiline onChange={(value) => updatePath(`signature.items.${activeElement.index}.text`, value)} />
            </FieldGroup>
          </div>
        )
      }

      return (
        <div className="space-y-4">
          <FieldGroup title="Signature elements">
            <p className="text-sm leading-6 text-slate-600">
              Select the founder image to edit its photo, name, and role. Select the Signature heading to edit its title and description, or select one experience card to edit only that card.
            </p>
          </FieldGroup>
        </div>
      )
    }

    if (activeSection === 'journey') {
      return (
        <div className="space-y-4">
          <FieldGroup title="Journey elements">
            <p className="text-sm leading-6 text-slate-600">Select the image block, text group, or button in the preview to edit that element by itself.</p>
          </FieldGroup>
        </div>
      )
    }

    if (activeSection === 'why') {
      return (
        <div className="space-y-4">
          <FieldGroup title="Why Travel elements">
            <p className="text-sm leading-6 text-slate-600">Select the section heading or one reason card in the preview to edit only that element.</p>
          </FieldGroup>
        </div>
      )
    }

    if (activeSection === 'gallery') {
      return (
        <FieldGroup title="Gallery elements">
          <p className="text-sm leading-6 text-slate-600">Select the gallery heading to edit the text, or select the gallery images to manage the image set.</p>
        </FieldGroup>
      )
    }

    if (activeSection === 'reviews') {
      return (
        <FieldGroup title="Reviews content">
          <TextControl label="Title" value={content.reviews.title} onChange={(value) => updatePath('reviews.title', value)} />
          <TextControl label="Description" value={content.reviews.description} onChange={(value) => updatePath('reviews.description', value)} />
        </FieldGroup>
      )
    }

    if (activeSection === 'footerBand') {
      return (
        <ImageControl label="Footer image" image={content.footerBand} sectionId="footer-band" onChange={(image) => updatePath('footerBand', image)} />
      )
    }

    if (activeSection === 'footer') {
      return (
        <div className="space-y-4">
          <FieldGroup title="Footer content">
            <TextControl label="About text" value={content.footer.about} multiline onChange={(value) => updatePath('footer.about', value)} />
            <TextControl label="Phone" value={content.footer.phone} onChange={(value) => updatePath('footer.phone', value)} />
            <TextControl label="Email" value={content.footer.email} onChange={(value) => updatePath('footer.email', value)} />
            <TextControl label="Location" value={content.footer.location} onChange={(value) => updatePath('footer.location', value)} />
          </FieldGroup>
          <LinkEditor title="Footer quick links" links={content.footer.quickLinks} onChange={(links) => updatePath('footer.quickLinks', links)} />
          <LinkEditor title="Footer social links" links={content.footer.socials} onChange={(links) => updatePath('footer.socials', links)} />
        </div>
      )
    }

    return null
  }

  return (
    <div className="h-screen overflow-hidden bg-slate-100 text-slate-950">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsNavOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:text-brand-600"
            title="Open dashboard menu"
          >
            <FiMenu />
          </button>
          <button
            type="button"
            onClick={() => setIsEditorOpen((isOpen) => !isOpen)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:text-brand-600 lg:hidden"
            title="Toggle editor"
          >
            {isEditorOpen ? <FiX /> : <FiEdit3 />}
          </button>
          <img src={logoUrl} alt="Top Cloud Rwenzori Adventures" className="h-11 w-auto max-w-[155px] object-contain" />
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={resetDraft} disabled={isSaving || isPublishing || isLoading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:text-brand-600 disabled:opacity-60">
            <FiRefreshCw /> <span className="hidden sm:inline">Reset</span>
          </button>
          <button type="button" onClick={() => void handleSaveDraft()} disabled={isLoading || isSaving || isPublishing} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-brand-200 hover:text-brand-600 disabled:opacity-60">
            <FiSave /> <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={isLoading || isSaving || isPublishing || !hasPublishChanges}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold transition disabled:cursor-not-allowed ${
              hasPublishChanges
                ? 'bg-admin-accent text-white hover:bg-brand-600 disabled:opacity-60'
                : 'bg-slate-200 text-slate-500'
            }`}
            title={hasPublishChanges ? 'Publish homepage changes' : 'No changes to publish'}
          >
            <FiUpload /> <span className="hidden sm:inline">{isPublishing ? 'Publishing...' : 'Publish'}</span>
          </button>
        </div>
      </header>

      <div className="relative flex h-[calc(100vh-4rem)] min-h-0">
        <aside className={`${isEditorOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-16'} absolute inset-y-0 left-0 z-40 flex w-[22rem] max-w-[86vw] flex-col overflow-x-hidden border-r border-white/10 bg-[#111827] text-white shadow-2xl transition-all duration-300 lg:relative lg:inset-auto lg:max-w-none`}>
          <div className="flex h-14 items-center justify-end border-b border-white/10 px-4 lg:hidden">
            <button type="button" onClick={() => setIsEditorOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white hover:bg-white/15 lg:hidden">
              <FiX />
            </button>
          </div>

          <div className={`${isEditorOpen ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 py-5`}>
            <button type="button" disabled={isLoading || isSaving || isPublishing} onClick={() => selectElement('nav', { type: 'headerContent' })} className="mb-3 rounded-xl border border-white/10 px-3 py-3 text-left text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">Header</button>
            <button type="button" disabled={isLoading || isSaving || isPublishing} onClick={() => selectElement('hero', { type: 'heroContent' })} className="mb-4 rounded-xl border border-white/10 px-3 py-3 text-left text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">Hero Slides & Settings</button>
            {error ? <div className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}
            {notice ? <div className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100">{notice}</div> : null}

            {activeSection ? (
              <>
                <div className="mb-5">
                  <h2 className="text-xl font-black">{activeSectionLabel}</h2>
                </div>

                <div className="space-y-5 overflow-x-hidden [&_.bg-white]:bg-[#172033] [&_.text-slate-900]:text-white [&_.text-admin-dark]:text-white [&_.text-slate-700]:text-slate-200 [&_.text-slate-600]:text-slate-300 [&_.text-slate-500]:text-slate-400 [&_.border-slate-200]:border-white/10 [&_input]:bg-[#111827] [&_input]:text-white [&_textarea]:bg-[#111827] [&_textarea]:text-white [&_select]:bg-[#111827] [&_select]:text-white">
                  {renderActiveSectionPanel()}
                </div>
              </>
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center text-center">
                <p className="text-xl font-black text-white">Select element to edit</p>
              </div>
            )}
          </div>
          <div
            className={`pointer-events-none absolute bottom-5 left-4 right-4 z-50 flex justify-center transition-all duration-500 ease-out ${
              isPublishToastVisible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
            }`}
            aria-live="polite"
            aria-hidden={!isPublishToastVisible}
          >
            <div className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-5 py-2 text-sm font-black text-emerald-100 shadow-2xl shadow-black/30 backdrop-blur">
              Published
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          {isLoading ? (
            <section className="h-full p-6">
              <div className="h-full animate-pulse rounded-2xl bg-white" />
            </section>
          ) : (
            <div className="h-full overflow-auto bg-slate-200 p-0 lg:p-4">
              <div className="min-h-full w-full overflow-hidden bg-white shadow-xl transition-all duration-300">
                <div className="sticky top-0 z-30 flex min-h-14 cursor-pointer items-center justify-between bg-[#25424C]/95 px-8 text-white shadow-lg" role="button" tabIndex={0} aria-label="Edit header" onClick={() => selectElement('nav', { type: 'headerContent' })} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectElement('nav', { type: 'headerContent' }) } }}>
                <img src={content.nav.logo.src} alt={content.nav.logo.alt} className="h-9 w-auto max-w-[130px] object-contain" />
                  <nav className="hidden gap-6 text-xs font-bold lg:flex">
                    {content.nav.links.map((link) => <span key={link.id}>{link.label}</span>)}
                  </nav>
                  <span className="rounded-full px-4 py-2 text-xs font-black uppercase text-white" style={{ backgroundColor: content.nav.inquiryButton.color }}>
                    {content.nav.inquiryButton.text}
                  </span>
                </div>
                {visibleSectionOrder.map(renderSection)}
              </div>
            </div>
          )}
        </main>
      </div>

      {isGalleryModalOpen ? (
        <div className="fixed inset-0 z-[90]">
          <button type="button" className="absolute inset-0 bg-slate-950/70" onClick={closeGalleryModal} aria-label="Close gallery import" />
          <div className="absolute left-1/2 top-1/2 flex max-h-[88vh] w-[min(920px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">Import Gallery Images</h2>
                <p className="text-sm text-slate-500">Choose up to 10 images, arrange them, then import them into the homepage slider.</p>
              </div>
              <button type="button" onClick={closeGalleryModal} className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <FiX />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 px-4 py-6 text-center transition hover:bg-brand-50">
                <FiUpload className="h-6 w-6 text-brand-600" />
                <span className="mt-2 text-sm font-black text-slate-900">Select images</span>
                <span className="mt-1 text-xs text-slate-500">{galleryDraftImages.length}/10 selected</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  disabled={galleryDraftImages.length >= 10 || isImportingGallery}
                  onChange={handleGalleryDraftSelection}
                />
              </label>

              {galleryDraftImages.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {galleryDraftImages.map((image, index) => (
                    <div key={image.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img src={image.previewUrl} alt={image.file.name} className="h-36 w-full object-cover" />
                      <div className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{image.file.name}</p>
                          <p className="text-xs text-slate-500">Slide {index + 1}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => moveGalleryDraftImage(index, -1)} disabled={index === 0 || isImportingGallery} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Move up">
                            <FiArrowUp />
                          </button>
                          <button type="button" onClick={() => moveGalleryDraftImage(index, 1)} disabled={index === galleryDraftImages.length - 1 || isImportingGallery} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Move down">
                            <FiArrowDown />
                          </button>
                          <button type="button" onClick={() => removeGalleryDraftImage(image.id)} disabled={isImportingGallery} className="grid h-8 w-8 place-items-center rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30" title="Remove">
                            <FiTrash2 />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  No images selected yet.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button type="button" onClick={closeGalleryModal} disabled={isImportingGallery} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                Cancel
              </button>
              <button type="button" onClick={() => void importGalleryDraftImages()} disabled={galleryDraftImages.length === 0 || isImportingGallery} className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-black text-white hover:bg-brand-600 disabled:opacity-60">
                {isImportingGallery ? <FiRefreshCw className="animate-spin" /> : <FiUpload />}
                {isImportingGallery ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isNavOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button type="button" className="absolute inset-0 bg-slate-950/60" onClick={() => setIsNavOpen(false)} aria-label="Close dashboard menu" />
          <nav className="absolute left-0 top-0 flex h-full w-72 max-w-[86vw] flex-col bg-[#111827] px-5 py-6 text-white shadow-2xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <img src={logoUrl} alt="Top Cloud Rwenzori Adventures" className="h-12 w-auto max-w-[125px] object-contain" />
              <button type="button" onClick={() => setIsNavOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 hover:bg-white/15">
                <FiX />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsNavOpen(false)}
                    className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${isActive ? 'bg-admin-accent text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <Icon />
                    {item.label}
                  </NavLink>
                )
              })}
            </div>
            <NavLink to="/packages" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm font-bold text-slate-300 hover:bg-white/10">
              <FiHome /> Back to dashboard
            </NavLink>
          </nav>
        </div>
      ) : null}
    </div>
  )
}

export default CustomizePage
