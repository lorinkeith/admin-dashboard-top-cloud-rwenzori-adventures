import { supabase } from '../lib/supabaseClient'

const TOUR_IMAGES_BUCKET = 'tour-images'
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

export type PackageImageType = 'main' | 'hero'

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.',
    )
  }

  return supabase
}

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Please choose a JPG, PNG, WebP, or SVG image.'
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image must be smaller than 5MB.'
  }

  return null
}

export function sanitizeFileName(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const baseName = fileName
    .replace(/\.[^/.]+$/, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${baseName || 'image'}${extension ? `.${extension}` : ''}`
}

export function getPublicImageUrl(path: string) {
  const { data } = getSupabaseClient()
    .storage
    .from(TOUR_IMAGES_BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

export async function uploadPackageImage(
  file: File,
  slug: string,
  imageType: PackageImageType,
) {
  const validationError = validateImageFile(file)

  if (validationError) {
    throw new Error(validationError)
  }

  const safeSlug = slug || 'unslugged-package'
  const safeFileName = sanitizeFileName(file.name)
  const path = `packages/${safeSlug}/${imageType}/${Date.now()}-${safeFileName}`

  const { error } = await getSupabaseClient()
    .storage
    .from(TOUR_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return getPublicImageUrl(path)
}

export async function uploadGalleryImage(file: File, packageId: string) {
  const validationError = validateImageFile(file)

  if (validationError) {
    throw new Error(validationError)
  }

  const safePackageId = packageId || 'unknown-package'
  const safeFileName = sanitizeFileName(file.name)
  const path = `packages/${safePackageId}/gallery/${Date.now()}-${safeFileName}`

  const { error } = await getSupabaseClient()
    .storage
    .from(TOUR_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return getPublicImageUrl(path)
}

export async function uploadItineraryDayImage(
  file: File,
  packageId: string,
  dayNumber: number,
) {
  const validationError = validateImageFile(file)

  if (validationError) {
    throw new Error(validationError)
  }

  const safePackageId = packageId || 'unknown-package'
  const safeDayNumber = Number.isFinite(dayNumber) && dayNumber > 0 ? dayNumber : 1
  const safeFileName = sanitizeFileName(file.name)
  const path = `packages/${safePackageId}/itinerary/day-${safeDayNumber}/${Date.now()}-${safeFileName}`

  const { error } = await getSupabaseClient()
    .storage
    .from(TOUR_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return getPublicImageUrl(path)
}

export async function uploadRouteLocationImage(
  file: File,
  packageId: string,
  dayOrder: number,
) {
  const validationError = validateImageFile(file)

  if (validationError) {
    throw new Error(validationError)
  }

  const safePackageId = packageId || 'unknown-package'
  const safeDayOrder = Number.isFinite(dayOrder) && dayOrder > 0 ? dayOrder : 1
  const safeFileName = sanitizeFileName(file.name)
  const path = `packages/${safePackageId}/route/day-${safeDayOrder}/${Date.now()}-${safeFileName}`

  const { error } = await getSupabaseClient()
    .storage
    .from(TOUR_IMAGES_BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    throw new Error(error.message)
  }

  return getPublicImageUrl(path)
}
const TOUR_IMAGES_PUBLIC_URL_MARKER = `/storage/v1/object/public/${TOUR_IMAGES_BUCKET}/`

export function extractStoragePathFromPublicUrl(publicUrl: string | null | undefined) {
  if (!publicUrl) {
    return null
  }

  // Never interpret another project's URL as an object in this project's bucket.
  const ownPrefix = supabase?.storage.from(TOUR_IMAGES_BUCKET).getPublicUrl('').data.publicUrl
  if (!ownPrefix || !publicUrl.startsWith(ownPrefix)) return null

  const markerIndex = publicUrl.indexOf(TOUR_IMAGES_PUBLIC_URL_MARKER)

  if (markerIndex === -1) {
    return null
  }

  const pathStart = markerIndex + TOUR_IMAGES_PUBLIC_URL_MARKER.length
  const pathWithPossibleQuery = publicUrl.slice(pathStart)
  const path = pathWithPossibleQuery.split(/[?#]/)[0]

  if (!path || path.startsWith('http') || path.startsWith('/')) {
    return null
  }

  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}

export function isSupabaseTourImageUrl(publicUrl: string | null | undefined) {
  return Boolean(extractStoragePathFromPublicUrl(publicUrl))
}

export async function deletePackageImageUrls(imageUrls: Array<string | null | undefined>) {
  const client = getSupabaseClient()
  const unusedUrls: string[] = []
  for (const url of new Set(imageUrls.filter((value): value is string => Boolean(value)))) {
    if (!extractStoragePathFromPublicUrl(url)) continue
    // Duplicated packages share images. Keep any file still referenced by another
    // package, itinerary, map stop, or either homepage snapshot.
    const checks = await Promise.all([
      client.from('tour_packages').select('id').eq('main_image_url', url).limit(1),
      client.from('tour_packages').select('id').eq('hero_image_url', url).limit(1),
      client.from('tour_gallery_images').select('id').eq('image_url', url).limit(1),
      client.from('tour_itinerary_images').select('id').eq('image_url', url).limit(1),
      client.from('package_locations').select('id').eq('image_url', url).limit(1),
      client.from('homepage_customizations').select('draft_content,published_content'),
    ])
    if (checks.some(result => result.error)) continue
    if (checks.slice(0, 5).some(result => result.data?.length)) continue
    if (JSON.stringify(checks[5].data).includes(url)) continue
    unusedUrls.push(url)
  }
  const paths = Array.from(
    new Set(
      unusedUrls
        .map((imageUrl) => extractStoragePathFromPublicUrl(imageUrl))
        .filter((path): path is string => Boolean(path)),
    ),
  )

  if (paths.length === 0) {
    return
  }

  const { error } = await getSupabaseClient()
    .storage
    .from(TOUR_IMAGES_BUCKET)
    .remove(paths)

  if (error) {
    throw new Error(error.message)
  }
}



