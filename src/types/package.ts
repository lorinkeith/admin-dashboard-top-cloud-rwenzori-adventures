export type PackageStatus = 'draft' | 'published' | 'archived'

export type ItineraryDay = {
  id: string
  day_number: number
  title: string
  description: string
}

export type GalleryImage = {
  id: string
  package_id: string
  image_url: string
  alt_text?: string
  sort_order: number
}

export type TourPackage = {
  id: string
  title: string
  slug: string
  category: string
  duration: string
  starting_price_usd: number
  short_description: string
  overview: string
  main_image_url?: string
  status: PackageStatus
  created_at: string
  updated_at: string
}

export type CreateTourPackageInput = Omit<
  TourPackage,
  'id' | 'created_at' | 'updated_at'
>

export type UpdateTourPackageInput = Partial<CreateTourPackageInput>
