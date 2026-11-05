export type PackageStatus = 'draft' | 'published' | 'archived'
export type TourMapStyle = 'light' | 'green' | 'warm' | 'dark'
export type AccommodationTier = 'standard' | 'budget' | 'mid_range' | 'luxury'

export type TourPackage = {
  id: string
  title: string
  slug: string
  category: string
  duration_days: number
  price_from_usd: number | null
  price_budget_usd: number | null
  price_mid_range_usd: number | null
  price_luxury_usd: number | null
  accommodation_tier: AccommodationTier
  short_description: string
  overview: string
  main_image_url: string | null
  hero_image_url: string | null
  map_style: TourMapStyle
  status: PackageStatus
  display_order: number
  created_at: string
  updated_at: string
}

export type TourGalleryImage = {
  id: string
  package_id: string
  image_url: string
  alt_text: string | null
  caption: string | null
  sort_order: number
  created_at: string
}

export type TourHighlight = {
  id: string
  package_id: string
  title: string
  description: string | null
  sort_order: number
  created_at: string
}

export type TourItineraryDay = {
  id: string
  package_id: string
  day_number: number
  title: string
  overview: string
  accommodation_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type TourItineraryActivity = {
  id: string
  itinerary_day_id: string
  title: string
  description: string | null
  sort_order: number
  created_at: string
}

export type CreateTourItineraryActivityInput = Omit<
  TourItineraryActivity,
  'id' | 'created_at'
>

export type UpdateTourItineraryActivityInput = Partial<
  Pick<TourItineraryActivity, 'title' | 'description' | 'sort_order'>
>

export type TourItineraryImage = {
  id: string
  itinerary_day_id: string
  image_url: string
  alt_text: string | null
  caption: string | null
  sort_order: number
  created_at: string
}

export type CreateTourItineraryImageInput = Omit<
  TourItineraryImage,
  'id' | 'created_at'
>

export type UpdateTourItineraryImageInput = Partial<
  Pick<TourItineraryImage, 'alt_text' | 'caption' | 'sort_order'>
>

export type TourPackageLocation = {
  id: string
  package_id: string
  location_name: string
  latitude: number
  longitude: number
  notes: string | null
  image_url: string | null
  pin_color: string
  day_order: number
}

export type CreateTourPackageLocationInput = Omit<
  TourPackageLocation,
  'id' | 'created_at' | 'updated_at'
>

export type UpdateTourPackageLocationInput = Partial<
  Pick<
    TourPackageLocation,
    'location_name' | 'latitude' | 'longitude' | 'notes' | 'image_url' | 'pin_color' | 'day_order'
  >
>

export type CreateTourPackageInput = Omit<
  TourPackage,
  'id' | 'created_at' | 'updated_at' | 'display_order'
>

export type UpdateTourPackageInput = Partial<CreateTourPackageInput> & {
  display_order?: number
}

export type CreateTourGalleryImageInput = Omit<
  TourGalleryImage,
  'id' | 'created_at'
>

export type UpdateTourGalleryImageInput = Partial<
  Pick<TourGalleryImage, 'alt_text' | 'caption' | 'sort_order'>
>

export type CreateTourHighlightInput = Omit<TourHighlight, 'id' | 'created_at'>

export type UpdateTourHighlightInput = Partial<Omit<TourHighlight, 'id' | 'package_id'>>

export type CreateTourItineraryDayInput = Omit<
  TourItineraryDay,
  'id' | 'created_at' | 'updated_at'
>

export type UpdateTourItineraryDayInput =
  Partial<CreateTourItineraryDayInput>








