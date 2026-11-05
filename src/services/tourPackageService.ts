import { supabase } from '../lib/supabaseClient'
import type {
  CreateTourGalleryImageInput,
  CreateTourHighlightInput,
  CreateTourItineraryDayInput,
  CreateTourPackageInput,
  TourGalleryImage,
  TourHighlight,
  TourItineraryDay,
  TourPackage,
  UpdateTourItineraryDayInput,
  UpdateTourPackageInput,
} from '../types/tourPackage'

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.',
    )
  }

  return supabase
}

function throwIfSupabaseError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message)
  }
}

export async function getTourPackages(): Promise<TourPackage[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_packages')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error?.message.includes('display_order')) {
    const fallbackResult = await getSupabaseClient()
      .from('tour_packages')
      .select('*')
      .order('created_at', { ascending: false })

    throwIfSupabaseError(fallbackResult.error)
    return (fallbackResult.data ?? []).map((tourPackage, index) => ({
      ...tourPackage,
      display_order: index + 1,
    })) as TourPackage[]
  }

  throwIfSupabaseError(error)
  return data ?? []
}

export async function getTourPackageById(
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

export async function getTourPackageBySlug(
  slug: string,
): Promise<TourPackage | null> {
  const { data, error } = await getSupabaseClient()
    .from('tour_packages')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  throwIfSupabaseError(error)
  return data
}

export async function createTourPackage(
  data: CreateTourPackageInput,
): Promise<TourPackage> {
  const { data: tourPackage, error } = await getSupabaseClient()
    .from('tour_packages')
    .insert(data)
    .select()
    .single()

  throwIfSupabaseError(error)
  return tourPackage
}

export async function updateTourPackage(
  id: string,
  data: UpdateTourPackageInput,
): Promise<TourPackage> {
  const { data: tourPackage, error } = await getSupabaseClient()
    .from('tour_packages')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  throwIfSupabaseError(error)
  return tourPackage
}

export async function deleteTourPackage(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('tour_packages')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
}

export async function publishTourPackage(id: string): Promise<TourPackage> {
  return updateTourPackage(id, { status: 'published' })
}

export async function archiveTourPackage(id: string): Promise<TourPackage> {
  return updateTourPackage(id, { status: 'archived' })
}

export async function getPackageGallery(
  packageId: string,
): Promise<TourGalleryImage[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_gallery_images')
    .select('*')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function getPackageHighlights(
  packageId: string,
): Promise<TourHighlight[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_highlights')
    .select('*')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function getPackageItineraryDays(
  packageId: string,
): Promise<TourItineraryDay[]> {
  const { data, error } = await getSupabaseClient()
    .from('tour_itinerary_days')
    .select('*')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })

  throwIfSupabaseError(error)
  return data ?? []
}

export async function createGalleryImage(
  data: CreateTourGalleryImageInput,
): Promise<TourGalleryImage> {
  const { data: galleryImage, error } = await getSupabaseClient()
    .from('tour_gallery_images')
    .insert(data)
    .select()
    .single()

  throwIfSupabaseError(error)
  return galleryImage
}

export async function createHighlight(
  data: CreateTourHighlightInput,
): Promise<TourHighlight> {
  const { data: highlight, error } = await getSupabaseClient()
    .from('tour_highlights')
    .insert(data)
    .select()
    .single()

  throwIfSupabaseError(error)
  return highlight
}

export async function createItineraryDay(
  data: CreateTourItineraryDayInput,
): Promise<TourItineraryDay> {
  const { data: itineraryDay, error } = await getSupabaseClient()
    .from('tour_itinerary_days')
    .insert(data)
    .select()
    .single()

  throwIfSupabaseError(error)
  return itineraryDay
}

export async function updateItineraryDay(
  id: string,
  data: UpdateTourItineraryDayInput,
): Promise<TourItineraryDay> {
  const { data: itineraryDay, error } = await getSupabaseClient()
    .from('tour_itinerary_days')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  throwIfSupabaseError(error)
  return itineraryDay
}

export async function deleteItineraryDay(id: string): Promise<void> {
  const { error } = await getSupabaseClient()
    .from('tour_itinerary_days')
    .delete()
    .eq('id', id)

  throwIfSupabaseError(error)
}
