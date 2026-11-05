export type AnalyticsDateFilter = 'today' | '7d' | '30d' | '3m' | 'all'

export type AnalyticsOverview = {
  totalViews: number
  uniqueVisitors: number
  inquiries: number
  bookings: number
}

export type PackageAnalyticsRow = {
  tourId: string
  packageTitle: string
  packageSlug: string
  category: string
  durationDays: number
  imageUrl: string | null
  views: number
  uniqueVisitors: number
  inquiries: number
  bookings: number
}

export type ViewsOverTimeRow = {
  viewDate: string
  views: number
  uniqueVisitors: number
}