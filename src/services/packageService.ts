import { supabase } from '../lib/supabaseClient'
import { deletePackageImageUrls } from './storageService'
import type {
  CreateTourGalleryImageInput,
  CreateTourHighlightInput,
  CreateTourItineraryActivityInput,
  CreateTourItineraryDayInput,
  CreateTourItineraryImageInput,
  CreateTourPackageInput,
  CreateTourPackageLocationInput,
  TourGalleryImage,
  TourHighlight,
  TourItineraryActivity,
  TourItineraryDay,
  TourItineraryImage,
  TourPackage,
  TourPackageLocation,
  UpdateTourGalleryImageInput,
  UpdateTourHighlightInput,
  UpdateTourItineraryActivityInput,
  UpdateTourItineraryDayInput,
  UpdateTourItineraryImageInput,
  UpdateTourPackageInput,
  UpdateTourPackageLocationInput,
} from '../types/tourPackage'
import type { PackageStatus } from '../types/tourPackage'

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.',
    )
  }

  return supabase
}

function getReadableSupabaseError(error: { message: string } | null) {
  if (!error) {
    return ''
  }

  if (error.message.toLowerCase().includes('row-level security')) {
    return 'Permission denied. Please check Supabase RLS policies for tour_packages.'
  }

  return error.message
}

function throwIfSupabaseError(error: { message: string } | null) {
  const message = getReadableSupabaseError(error)

  if (message) {
    throw new Error(message)
  }
}

async function deleteStorageUrlsQuietly(
  imageUrls: Array<string | null | undefined>,
  context: string,
) {
  try {
    await deletePackageImageUrls(imageUrls)
  } catch (imageDeleteError) {
    const message =
      imageDeleteError instanceof Error
        ? imageDeleteError.message
        : String(imageDeleteError)

    console.warn(`${context} image cleanup failed:`, message)
  }
}

async function getImageUrlsForPackage(packageId: string) {
  const client = getSupabaseClient()
  const [packageResult, galleryResult, locationsResult, daysResult] = await Promise.all([
    client
      .from('tour_packages')
      .select('main_image_url,hero_image_url')
      .eq('id', packageId)
      .maybeSingle(),
    client
      .from('tour_gallery_images')
      .select('image_url')
      .eq('package_id', packageId),
    client
      .from('package_locations')
      .select('image_url')
      .eq('package_id', packageId),
    client
      .from('tour_itinerary_days')
      .select('id')
      .eq('package_id', packageId),
  ])

  throwIfSupabaseError(packageResult.error)
  throwIfSupabaseError(galleryResult.error)
  throwIfSupabaseError(locationsResult.error)
  throwIfSupabaseError(daysResult.error)

  const dayIds = (daysResult.data ?? []).map((day) => day.id)
  let itineraryImages: Array<{ image_url: string | null }> = []

  if (dayIds.length > 0) {
    const itineraryImagesResult = await client
      .from('tour_itinerary_images')
      .select('image_url')
      .in('itinerary_day_id', dayIds)

    throwIfSupabaseError(itineraryImagesResult.error)
    itineraryImages = itineraryImagesResult.data ?? []
  }

  return [
    packageResult.data?.main_image_url,
    packageResult.data?.hero_image_url,
    ...(galleryResult.data ?? []).map((image) => image.image_url),
    ...(locationsResult.data ?? []).map((location) => location.image_url),
    ...itineraryImages.map((image) => image.image_url),
  ]
}

async function getImageUrlsForItineraryDay(dayId: string) {
  const { data, error } = await getSupabaseClient()
    .from('tour_itinerary_images')
    .select('image_url')
    .eq('itinerary_day_id', dayId)

  throwIfSupabaseError(error)
  return (data ?? []).map((image) => image.image_url)
}

function createSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getDefaultPriceFrom(tourPackage: Pick<TourPackage, 'accommodation_tier' | 'price_from_usd' | 'price_budget_usd' | 'price_mid_range_usd' | 'price_luxury_usd'>) {
  if (tourPackage.accommodation_tier === 'budget') return tourPackage.price_budget_usd ?? tourPackage.price_from_usd
  if (tourPackage.accommodation_tier === 'mid_range') return tourPackage.price_mid_range_usd ?? tourPackage.price_from_usd
  if (tourPackage.accommodation_tier === 'luxury') return tourPackage.price_luxury_usd ?? tourPackage.price_from_usd

  return tourPackage.price_mid_range_usd ?? tourPackage.price_budget_usd ?? tourPackage.price_luxury_usd ?? tourPackage.price_from_usd
}

function withDefaultPriceFrom(tourPackage: TourPackage): TourPackage {
  return {
    ...tourPackage,
    price_from_usd: getDefaultPriceFrom(tourPackage),
  }
}

function getCopyName(baseTitle: string, existingTitles: string[]) {
  const normalizedTitles = new Set(existingTitles.map((title) => title.trim().toLowerCase()))
  const sourceBaseTitle = baseTitle
    .trim()
    .replace(/\s+copy(?:-\d+)?$/i, '')
    .replace(/\s+duplicate(?:-\d+)?$/i, '')
  const firstCopy = `${sourceBaseTitle} duplicate-1`

  if (!normalizedTitles.has(firstCopy.toLowerCase())) {
    return firstCopy
  }

  let copyNumber = 2
  let nextTitle = `${sourceBaseTitle} duplicate-${copyNumber}`

  while (normalizedTitles.has(nextTitle.toLowerCase())) {
    copyNumber += 1
    nextTitle = `${sourceBaseTitle} duplicate-${copyNumber}`
  }

  return nextTitle
}

function getCopySlug(copyTitle: string, existingSlugs: string[]) {
  const normalizedSlugs = new Set(existingSlugs)
  const baseSlug = createSlug(copyTitle)

  if (!normalizedSlugs.has(baseSlug)) {
    return baseSlug
  }

  let copyNumber = 2
  let nextSlug = `${baseSlug}-${copyNumber}`

  while (normalizedSlugs.has(nextSlug)) {
    copyNumber += 1
    nextSlug = `${baseSlug}-${copyNumber}`
  }

  return nextSlug
}

async function requireAuthenticatedUser() {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  if (!data.session) {
    throw new Error('You must be logged in to manage tour packages.')
  }

  return client
}

export async function getPackages(): Promise<TourPackage[]> {
  console.log('Fetching tour packages...')

  const { data, error } = await getSupabaseClient()
    .from('tour_packages')
    .select(
      'id,title,slug,category,duration_days,price_from_usd,price_budget_usd,price_mid_range_usd,price_luxury_usd,accommodation_tier,short_description,overview,main_image_url,hero_image_url,map_style,status,display_order,created_at,updated_at',
    )
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  console.log('Packages returned:', data?.length ?? 0)
  console.log('Packages fetch error:', error?.message)

  if (
    error?.message.includes('display_order') ||
    error?.message.includes('accommodation_tier') ||
    error?.message.includes('price_budget_usd') ||
    error?.message.includes('price_mid_range_usd') ||
    error?.message.includes('price_luxury_usd')
  ) {
    const fallbackResult = await getSupabaseClient()
      .from('tour_packages')
      .select(
      'id,title,slug,category,duration_days,price_from_usd,short_description,overview,main_image_url,hero_image_url,map_style,status,created_at,updated_at',
      )
      .order('created_at', { ascending: false })

    throwIfSupabaseError(fallbackResult.error)
    return (fallbackResult.data ?? []).map((tourPackage, index) => ({
      ...tourPackage,
      accommodation_tier: 'standard',
      price_budget_usd: tourPackage.price_from_usd,
      price_mid_range_usd: tourPackage.price_from_usd,
      price_luxury_usd: null,
      display_order: index + 1,
    })) as TourPackage[]
  }

  throwIfSupabaseError(error)
  return ((data ?? []) as TourPackage[]).map(withDefaultPriceFrom)
}

export async function getPackageById(
  id: string,
): Promise<TourPackage | null> {
  const { data, error } = await getSupabaseClient()
    .from('tour_packages')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwIfSupabaseError(error)
  return data
}

export async function getTourPackageById(
  id: string,
): Promise<TourPackage | null> {
  return getPackageById(id)
}

export async function createPackage(
  data: CreateTourPackageInput,
): Promise<TourPackage> {
  const client = await requireAuthenticatedUser()
  const { data: latestPackage, error: latestPackageError } = await client
    .from('tour_packages')
    .select('display_order')
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  throwIfSupabaseError(latestPackageError)

  const { data: tourPackage, error } = await client
    .from('tour_packages')
    .insert({
      ...data,
      display_order: Number(latestPackage?.display_order ?? 0) + 1,
    })
    .select()
    .single()

  throwIfSupabaseError(error)
  return tourPackage
}

export async function createTourPackage(
  data: CreateTourPackageInput,
): Promise<TourPackage> {
  return createPackage(data)
}

export async function updatePackage(
  id: string,
  data: UpdateTourPackageInput,
): Promise<TourPackage> {
  const client = await requireAuthenticatedUser()
  const shouldCleanupPackageImages =
    Object.prototype.hasOwnProperty.call(data, 'main_image_url') ||
    Object.prototype.hasOwnProperty.call(data, 'hero_image_url')
  let previousPackageImages: Pick<TourPackage, 'main_image_url' | 'hero_image_url'> | null = null

  if (shouldCleanupPackageImages) {
    const { data: currentPackage, error: fetchError } = await client
      .from('tour_packages')
      .select('main_image_url,hero_image_url')
      .eq('id', id)
      .maybeSingle()

    throwIfSupabaseError(fetchError)
    previousPackageImages = currentPackage
  }

  const { data: tourPackage, error } = await client
    .from('tour_packages')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  throwIfSupabaseError(error)

  if (previousPackageImages) {
    const staleImageUrls = [
      previousPackageImages.main_image_url !== tourPackage.main_image_url
        ? previousPackageImages.main_image_url
        : null,
      previousPackageImages.hero_image_url !== tourPackage.hero_image_url
        ? previousPackageImages.hero_image_url
        : null,
    ]

    await deleteStorageUrlsQuietly(staleImageUrls, 'Package')
  }

  return tourPackage
}

export async function updateTourPackage(
  id: string,
  data: UpdateTourPackageInput,
): Promise<TourPackage> {
  return updatePackage(id, data)
}

export async function updateTourPackageStatuses(
  ids: string[],
  status: PackageStatus,
): Promise<void> {
  if (ids.length === 0) return

  const client = await requireAuthenticatedUser()
  const { error } = await client
    .from('tour_packages')
    .update({ status })
    .in('id', ids)

  throwIfSupabaseError(error)
}

export async function deletePackage(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const imageUrls = await getImageUrlsForPackage(id)

  const { error } = await client
    .from('tour_packages')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
  await deleteStorageUrlsQuietly(imageUrls, 'Package')
}
export async function deleteTourPackage(id: string): Promise<void> {
  return deletePackage(id)
}

export async function updatePackagesOrder(
  packages: Pick<TourPackage, 'id' | 'display_order'>[],
): Promise<void> {
  const client = await requireAuthenticatedUser()
  const temporaryOffset = packages.length + 1000

  await Promise.all(
    packages.map(async (tourPackage, index) => {
      const { error } = await client
        .from('tour_packages')
        .update({ display_order: temporaryOffset + index + 1 })
        .eq('id', tourPackage.id)

      throwIfSupabaseError(error)
    }),
  )

  await Promise.all(
    packages.map(async (tourPackage, index) => {
      const { error } = await client
        .from('tour_packages')
        .update({ display_order: index + 1 })
        .eq('id', tourPackage.id)

      throwIfSupabaseError(error)
    }),
  )
}

export async function duplicateTourPackage(id: string): Promise<TourPackage> {
  const client = await requireAuthenticatedUser()

  const { data: sourcePackage, error: packageError } = await client
    .from('tour_packages')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  throwIfSupabaseError(packageError)

  if (!sourcePackage) {
    throw new Error('Package to duplicate was not found.')
  }

  const { data: existingPackages, error: existingError } = await client
    .from('tour_packages')
    .select('title,slug')

  throwIfSupabaseError(existingError)

  const copyTitle = getCopyName(
    sourcePackage.title,
    (existingPackages ?? []).map((tourPackage) => tourPackage.title),
  )
  const copySlug = getCopySlug(
    copyTitle,
    (existingPackages ?? []).map((tourPackage) => tourPackage.slug),
  )

  const { data: duplicatedPackage, error: duplicateError } = await client
    .from('tour_packages')
    .insert({
      category: sourcePackage.category,
      duration_days: sourcePackage.duration_days,
      hero_image_url: sourcePackage.hero_image_url,
      main_image_url: sourcePackage.main_image_url,
      map_style: sourcePackage.map_style ?? 'light',
      overview: sourcePackage.overview,
      price_from_usd: sourcePackage.price_from_usd,
      price_budget_usd: Object.prototype.hasOwnProperty.call(sourcePackage, 'price_budget_usd')
        ? sourcePackage.price_budget_usd
        : sourcePackage.price_from_usd,
      price_mid_range_usd: Object.prototype.hasOwnProperty.call(sourcePackage, 'price_mid_range_usd')
        ? sourcePackage.price_mid_range_usd
        : sourcePackage.price_from_usd,
      price_luxury_usd: Object.prototype.hasOwnProperty.call(sourcePackage, 'price_luxury_usd')
        ? sourcePackage.price_luxury_usd
        : null,
      accommodation_tier: sourcePackage.accommodation_tier ?? 'standard',
      short_description: sourcePackage.short_description,
      slug: copySlug,
      status: 'draft',
      title: copyTitle,
      display_order: Number(sourcePackage.display_order ?? 0) + 1,
    })
    .select()
    .single()

  throwIfSupabaseError(duplicateError)

  if (!duplicatedPackage) {
    throw new Error('Package duplicate was not created.')
  }

  const [
    highlightsResult,
    galleryResult,
    daysResult,
    locationsResult,
  ] = await Promise.all([
    client
      .from('tour_highlights')
      .select('title,description,sort_order')
      .eq('package_id', id)
      .order('sort_order', { ascending: true }),
    client
      .from('tour_gallery_images')
      .select('image_url,alt_text,caption,sort_order')
      .eq('package_id', id)
      .order('sort_order', { ascending: true }),
    client
      .from('tour_itinerary_days')
      .select('id,day_number,title,overview,accommodation_name,sort_order')
      .eq('package_id', id)
      .order('sort_order', { ascending: true })
      .order('day_number', { ascending: true }),
    client
      .from('package_locations')
      .select('location_name,latitude,longitude,notes,image_url,pin_color,day_order')
      .eq('package_id', id)
      .order('day_order', { ascending: true }),
  ])

  throwIfSupabaseError(highlightsResult.error)
  throwIfSupabaseError(galleryResult.error)
  throwIfSupabaseError(daysResult.error)
  throwIfSupabaseError(locationsResult.error)

  const duplicatedPackageId = duplicatedPackage.id

  if ((highlightsResult.data ?? []).length > 0) {
    const { error } = await client.from('tour_highlights').insert(
      (highlightsResult.data ?? []).map((highlight) => ({
        ...highlight,
        package_id: duplicatedPackageId,
      })),
    )
    throwIfSupabaseError(error)
  }

  if ((galleryResult.data ?? []).length > 0) {
    const { error } = await client.from('tour_gallery_images').insert(
      (galleryResult.data ?? []).map((image) => ({
        ...image,
        package_id: duplicatedPackageId,
      })),
    )
    throwIfSupabaseError(error)
  }

  if ((locationsResult.data ?? []).length > 0) {
    const { error } = await client.from('package_locations').insert(
      (locationsResult.data ?? []).map((location) => ({
        ...location,
        package_id: duplicatedPackageId,
        pin_color: location.pin_color ?? '#007A24',
      })),
    )
    throwIfSupabaseError(error)
  }

  const sourceDays = daysResult.data ?? []

  for (const sourceDay of sourceDays) {
    const { id: sourceDayId, ...dayCopy } = sourceDay
    const { data: duplicatedDay, error: dayError } = await client
      .from('tour_itinerary_days')
      .insert({
        ...dayCopy,
        package_id: duplicatedPackageId,
      })
      .select('id')
      .single()

    throwIfSupabaseError(dayError)

    if (!duplicatedDay) {
      throw new Error('Itinerary day duplicate was not created.')
    }

    const [activitiesResult, imagesResult] = await Promise.all([
      client
        .from('tour_itinerary_activities')
        .select('title,description,sort_order')
        .eq('itinerary_day_id', sourceDayId)
        .order('sort_order', { ascending: true }),
      client
        .from('tour_itinerary_images')
        .select('image_url,alt_text,caption,sort_order')
        .eq('itinerary_day_id', sourceDayId)
        .order('sort_order', { ascending: true }),
    ])

    throwIfSupabaseError(activitiesResult.error)
    throwIfSupabaseError(imagesResult.error)

    if ((activitiesResult.data ?? []).length > 0) {
      const { error } = await client.from('tour_itinerary_activities').insert(
        (activitiesResult.data ?? []).map((activity) => ({
          ...activity,
          itinerary_day_id: duplicatedDay.id,
        })),
      )
      throwIfSupabaseError(error)
    }

    if ((imagesResult.data ?? []).length > 0) {
      const { error } = await client.from('tour_itinerary_images').insert(
        (imagesResult.data ?? []).map((image) => ({
          ...image,
          itinerary_day_id: duplicatedDay.id,
        })),
      )
      throwIfSupabaseError(error)
    }
  }

  return duplicatedPackage
}

export async function getPackageHighlights(packageId: string): Promise<TourHighlight[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_highlights')
    .select('id,package_id,title,description,sort_order,created_at')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function createPackageHighlight(
  data: CreateTourHighlightInput,
): Promise<TourHighlight> {
  const client = await requireAuthenticatedUser()
  const { data: highlight, error } = await client
    .from('tour_highlights')
    .insert(data)
    .select('id,package_id,title,description,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)
  
  if (!highlight) {
    throw new Error('Highlight was not created.')
  }

  return highlight
}

export async function updatePackageHighlight(
  id: string,
  data: UpdateTourHighlightInput,
): Promise<TourHighlight> {
  const client = await requireAuthenticatedUser()
  const { data: highlight, error } = await client
    .from('tour_highlights')
    .update(data)
    .eq('id', id)
    .select('id,package_id,title,description,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)
  
  if (!highlight) {
    throw new Error('Highlight was not updated.')
  }

  return highlight
}

export async function deletePackageHighlight(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const { error } = await client
    .from('tour_highlights')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
}

export async function getPackageGalleryImages(
  packageId: string,
): Promise<TourGalleryImage[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_gallery_images')
    .select('id,package_id,image_url,alt_text,caption,sort_order,created_at')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function createGalleryImage(
  data: CreateTourGalleryImageInput,
): Promise<TourGalleryImage> {
  const client = await requireAuthenticatedUser()
  const { data: galleryImage, error } = await client
    .from('tour_gallery_images')
    .insert(data)
    .select('id,package_id,image_url,alt_text,caption,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)

  if (!galleryImage) {
    throw new Error('Gallery image was not created.')
  }

  return galleryImage
}

export async function updateGalleryImage(
  id: string,
  data: UpdateTourGalleryImageInput,
): Promise<TourGalleryImage> {
  const client = await requireAuthenticatedUser()
  const { data: galleryImage, error } = await client
    .from('tour_gallery_images')
    .update(data)
    .eq('id', id)
    .select('id,package_id,image_url,alt_text,caption,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)

  if (!galleryImage) {
    throw new Error('Gallery image was not updated.')
  }

  return galleryImage
}

export async function deleteGalleryImage(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const { data: image, error: fetchError } = await client
    .from('tour_gallery_images')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()

  throwIfSupabaseError(fetchError)

  const { error } = await client
    .from('tour_gallery_images')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
  await deleteStorageUrlsQuietly([image?.image_url], 'Gallery')
}

export async function getPackageItineraryDays(
  packageId: string,
): Promise<TourItineraryDay[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_itinerary_days')
    .select('id,package_id,day_number,title,overview,accommodation_name,sort_order,created_at,updated_at')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })
    .order('day_number', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function createItineraryDay(
  data: CreateTourItineraryDayInput,
): Promise<TourItineraryDay> {
  const client = await requireAuthenticatedUser()
  const { data: itineraryDay, error } = await client
    .from('tour_itinerary_days')
    .insert(data)
    .select('id,package_id,day_number,title,overview,accommodation_name,sort_order,created_at,updated_at')
    .single()

  throwIfSupabaseError(error)

  if (!itineraryDay) {
    throw new Error('Itinerary day was not created.')
  }

  return itineraryDay
}

export async function updateItineraryDay(
  id: string,
  data: UpdateTourItineraryDayInput,
): Promise<TourItineraryDay> {
  const client = await requireAuthenticatedUser()
  const { data: itineraryDay, error } = await client
    .from('tour_itinerary_days')
    .update(data)
    .eq('id', id)
    .select('id,package_id,day_number,title,overview,accommodation_name,sort_order,created_at,updated_at')
    .single()

  throwIfSupabaseError(error)

  if (!itineraryDay) {
    throw new Error('Itinerary day was not updated.')
  }

  return itineraryDay
}

export async function updateItineraryDaysOrder(
  days: Pick<TourItineraryDay, 'id' | 'day_number' | 'sort_order'>[],
): Promise<void> {
  const client = await requireAuthenticatedUser()
  const temporaryOffset = days.length + 1000

  await Promise.all(
    days.map(async (day, index) => {
      const { error } = await client
        .from('tour_itinerary_days')
        .update({
          day_number: temporaryOffset + index + 1,
          sort_order: temporaryOffset + index + 1,
        })
        .eq('id', day.id)

      throwIfSupabaseError(error)
    }),
  )

  await Promise.all(
    days.map(async (day, index) => {
      const nextOrder = index + 1
      const { error } = await client
        .from('tour_itinerary_days')
        .update({
          day_number: nextOrder,
          sort_order: nextOrder,
        })
        .eq('id', day.id)

      throwIfSupabaseError(error)
    }),
  )
}

export async function deleteItineraryDay(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const imageUrls = await getImageUrlsForItineraryDay(id)
  const { error } = await client
    .from('tour_itinerary_days')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
  await deleteStorageUrlsQuietly(imageUrls, 'Itinerary day')
}

export async function getPackageLocations(packageId: string): Promise<TourPackageLocation[]> {
  const { data, error } = await getSupabaseClient()
    .from('package_locations')
    .select('id,package_id,location_name,latitude,longitude,notes,image_url,pin_color,day_order')
    .eq('package_id', packageId)
    .order('day_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function createPackageLocation(
  data: CreateTourPackageLocationInput,
): Promise<TourPackageLocation> {
  const client = await requireAuthenticatedUser()
  const { data: location, error } = await client
    .from('package_locations')
    .insert(data)
    .select('id,package_id,location_name,latitude,longitude,notes,image_url,pin_color,day_order')
    .single()

  throwIfSupabaseError(error)

  if (!location) {
    throw new Error('Package location was not created.')
  }

  return location
}

export async function updatePackageLocation(
  id: string,
  data: UpdateTourPackageLocationInput,
): Promise<TourPackageLocation> {
  const client = await requireAuthenticatedUser()
  const shouldCleanupLocationImage = Object.prototype.hasOwnProperty.call(data, 'image_url')
  let previousImageUrl: string | null | undefined

  if (shouldCleanupLocationImage) {
    const { data: currentLocation, error: fetchError } = await client
      .from('package_locations')
      .select('image_url')
      .eq('id', id)
      .maybeSingle()

    throwIfSupabaseError(fetchError)
    previousImageUrl = currentLocation?.image_url
  }

  const { data: location, error } = await client
    .from('package_locations')
    .update(data)
    .eq('id', id)
    .select('id,package_id,location_name,latitude,longitude,notes,image_url,pin_color,day_order')
    .single()

  throwIfSupabaseError(error)

  if (!location) {
    throw new Error('Package location was not updated.')
  }

  if (shouldCleanupLocationImage && previousImageUrl !== location.image_url) {
    await deleteStorageUrlsQuietly([previousImageUrl], 'Location')
  }

  return location
}

export async function updatePackageLocationsOrder(
  locations: Pick<TourPackageLocation, 'id' | 'day_order'>[],
): Promise<void> {
  const client = await requireAuthenticatedUser()
  const temporaryOffset = locations.length + 1000

  await Promise.all(
    locations.map(async (location, index) => {
      const { error } = await client
        .from('package_locations')
        .update({ day_order: temporaryOffset + index + 1 })
        .eq('id', location.id)

      throwIfSupabaseError(error)
    }),
  )

  await Promise.all(
    locations.map(async (location, index) => {
      const { error } = await client
        .from('package_locations')
        .update({ day_order: index + 1 })
        .eq('id', location.id)

      throwIfSupabaseError(error)
    }),
  )
}

export async function deletePackageLocation(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const { data: location, error: fetchError } = await client
    .from('package_locations')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()

  throwIfSupabaseError(fetchError)

  const { error } = await client
    .from('package_locations')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
  await deleteStorageUrlsQuietly([location?.image_url], 'Location')
}

export async function getActivitiesForDay(
  dayId: string,
): Promise<TourItineraryActivity[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_itinerary_activities')
    .select('id,itinerary_day_id,title,description,sort_order,created_at')
    .eq('itinerary_day_id', dayId)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function getActivitiesForPackageDays(
  dayIds: string[],
): Promise<TourItineraryActivity[]> {
  if (dayIds.length === 0) {
    return []
  }

  const { data, error } = await getSupabaseClient()
    .from('tour_itinerary_activities')
    .select('id,itinerary_day_id,title,description,sort_order,created_at')
    .in('itinerary_day_id', dayIds)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function createItineraryActivity(
  data: CreateTourItineraryActivityInput,
): Promise<TourItineraryActivity> {
  const client = await requireAuthenticatedUser()
  const { data: activity, error } = await client
    .from('tour_itinerary_activities')
    .insert(data)
    .select('id,itinerary_day_id,title,description,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)

  if (!activity) {
    throw new Error('Itinerary activity was not created.')
  }

  return activity
}

export async function updateItineraryActivity(
  id: string,
  data: UpdateTourItineraryActivityInput,
): Promise<TourItineraryActivity> {
  const client = await requireAuthenticatedUser()
  const { data: activity, error } = await client
    .from('tour_itinerary_activities')
    .update(data)
    .eq('id', id)
    .select('id,itinerary_day_id,title,description,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)

  if (!activity) {
    throw new Error('Itinerary activity was not updated.')
  }

  return activity
}

export async function deleteItineraryActivity(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const { error } = await client
    .from('tour_itinerary_activities')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
}

export async function getImagesForDay(
  dayId: string,
): Promise<TourItineraryImage[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_itinerary_images')
    .select('id,itinerary_day_id,image_url,alt_text,caption,sort_order,created_at')
    .eq('itinerary_day_id', dayId)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function getImagesForPackageDays(
  dayIds: string[],
): Promise<TourItineraryImage[]> {
  if (dayIds.length === 0) {
    return []
  }

  const { data, error } = await getSupabaseClient()
    .from('tour_itinerary_images')
    .select('id,itinerary_day_id,image_url,alt_text,caption,sort_order,created_at')
    .in('itinerary_day_id', dayIds)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function createItineraryImage(
  data: CreateTourItineraryImageInput,
): Promise<TourItineraryImage> {
  const client = await requireAuthenticatedUser()
  const { data: image, error } = await client
    .from('tour_itinerary_images')
    .insert(data)
    .select('id,itinerary_day_id,image_url,alt_text,caption,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)

  if (!image) {
    throw new Error('Itinerary image was not created.')
  }

  return image
}

export async function updateItineraryImage(
  id: string,
  data: UpdateTourItineraryImageInput,
): Promise<TourItineraryImage> {
  const client = await requireAuthenticatedUser()
  const { data: image, error } = await client
    .from('tour_itinerary_images')
    .update(data)
    .eq('id', id)
    .select('id,itinerary_day_id,image_url,alt_text,caption,sort_order,created_at')
    .single()

  throwIfSupabaseError(error)

  if (!image) {
    throw new Error('Itinerary image was not updated.')
  }

  return image
}

export async function deleteItineraryImage(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const { data: image, error: fetchError } = await client
    .from('tour_itinerary_images')
    .select('image_url')
    .eq('id', id)
    .maybeSingle()

  throwIfSupabaseError(fetchError)

  const { error } = await client
    .from('tour_itinerary_images')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
  await deleteStorageUrlsQuietly([image?.image_url], 'Itinerary')
}

