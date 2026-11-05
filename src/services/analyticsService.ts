import { supabase } from '../lib/supabaseClient'
import type {
  AnalyticsDateFilter,
  AnalyticsOverview,
  PackageAnalyticsRow,
  ViewsOverTimeRow,
} from '../types/analytics'

type AnalyticsRange = {
  startAt: string | null
  endAt: string | null
}

type OverviewRpcRow = {
  total_views: number | string | null
  unique_visitors: number | string | null
  inquiries: number | string | null
  bookings: number | string | null
}

type PackageAnalyticsRpcRow = {
  tour_id: string
  package_title: string
  package_slug: string
  views: number | string | null
  unique_visitors: number | string | null
  inquiries: number | string | null
  bookings: number | string | null
}

type PackageMetaRow = {
  id: string
  category: string | null
  duration_days: number | null
  main_image_url: string | null
  hero_image_url: string | null
}

type ViewsOverTimeRpcRow = {
  view_date: string
  views: number | string | null
  unique_visitors: number | string | null
}

type SubmissionAnalyticsRow = {
  package_id: string | null
  tour_package_name: string | null
  type: 'booking' | 'inquiry'
}

type SubmissionAnalyticsCounts = {
  overview: Pick<AnalyticsOverview, 'bookings' | 'inquiries'>
  byPackageId: Map<string, Pick<AnalyticsOverview, 'bookings' | 'inquiries'>>
  byPackageName: Map<string, Pick<AnalyticsOverview, 'bookings' | 'inquiries'>>
}

export type AnalyticsData = {
  overview: AnalyticsOverview
  packages: PackageAnalyticsRow[]
  viewsOverTime: ViewsOverTimeRow[]
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.',
    )
  }

  return supabase
}

async function requireAuthenticatedUser() {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  if (!data.session) {
    throw new Error('You must be logged in to view analytics.')
  }

  return client
}

function toNumber(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) ? numberValue : 0
}

function getStartOfToday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export function getAnalyticsRange(filter: AnalyticsDateFilter): AnalyticsRange {
  if (filter === 'all') {
    return { startAt: null, endAt: null }
  }

  const start = getStartOfToday()

  if (filter === '7d') {
    start.setDate(start.getDate() - 6)
  } else if (filter === '30d') {
    start.setDate(start.getDate() - 29)
  } else if (filter === '3m') {
    start.setMonth(start.getMonth() - 3)
  }

  return {
    endAt: null,
    startAt: start.toISOString(),
  }
}

function getReadableSupabaseError(error: { message: string } | null) {
  if (!error) return ''

  if (error.message.toLowerCase().includes('function')) {
    return 'Analytics database functions are not available yet. Run supabase/RUN_THIS_SETUP.sql in Supabase SQL Editor (or setup files 01–05 in order).'
  }

  if (error.message.toLowerCase().includes('row-level security')) {
    return 'Permission denied. Please check Supabase RLS policies for tour analytics.'
  }

  return error.message
}

function throwIfSupabaseError(error: { message: string } | null) {
  const message = getReadableSupabaseError(error)

  if (message) {
    throw new Error(message)
  }
}

async function getSubmissionAnalyticsCounts(range: AnalyticsRange): Promise<SubmissionAnalyticsCounts> {
  const client = getSupabaseClient()

  let query = client
    .from('form_submissions')
    .select('package_id,tour_package_name,type')
    .in('type', ['booking', 'inquiry'])

  if (range.startAt) {
    query = query.gte('created_at', range.startAt)
  }

  if (range.endAt) {
    query = query.lt('created_at', range.endAt)
  }

  const { data, error } = await query

  throwIfSupabaseError(error)

  const counts: SubmissionAnalyticsCounts = {
    byPackageId: new Map(),
    byPackageName: new Map(),
    overview: {
      bookings: 0,
      inquiries: 0,
    },
  }

  ;((data ?? []) as SubmissionAnalyticsRow[]).forEach((submission) => {
    const key = submission.type === 'booking' ? 'bookings' : 'inquiries'
    counts.overview[key] += 1

    if (submission.package_id) {
      const packageCounts = counts.byPackageId.get(submission.package_id) ?? {
        bookings: 0,
        inquiries: 0,
      }
      packageCounts[key] += 1
      counts.byPackageId.set(submission.package_id, packageCounts)
      return
    }

    const packageName = submission.tour_package_name?.trim().toLowerCase()
    if (!packageName) {
      return
    }

    const packageCounts = counts.byPackageName.get(packageName) ?? {
      bookings: 0,
      inquiries: 0,
    }
    packageCounts[key] += 1
    counts.byPackageName.set(packageName, packageCounts)
  })

  return counts
}

export async function getAnalyticsData(filter: AnalyticsDateFilter): Promise<AnalyticsData> {
  const client = await requireAuthenticatedUser()
  const range = getAnalyticsRange(filter)
  const rpcArgs = {
    p_end_at: range.endAt,
    p_start_at: range.startAt,
  }

  const [overviewResult, packagesResult, viewsOverTimeResult, packageMetaResult, submissionCounts] = await Promise.all([
    client.rpc('get_tour_analytics_overview', rpcArgs),
    client.rpc('get_tour_package_analytics', rpcArgs),
    client.rpc('get_tour_views_over_time', rpcArgs),
    client
      .from('tour_packages')
      .select('id,category,duration_days,main_image_url,hero_image_url'),
    getSubmissionAnalyticsCounts(range),
  ])

  throwIfSupabaseError(overviewResult.error)
  throwIfSupabaseError(packagesResult.error)
  throwIfSupabaseError(viewsOverTimeResult.error)
  throwIfSupabaseError(packageMetaResult.error)

  const overviewRow = ((overviewResult.data ?? []) as OverviewRpcRow[])[0]
  const packageMetaById = new Map(
    ((packageMetaResult.data ?? []) as PackageMetaRow[]).map((tourPackage) => [tourPackage.id, tourPackage]),
  )

  return {
    overview: {
      bookings: submissionCounts.overview.bookings,
      inquiries: submissionCounts.overview.inquiries,
      totalViews: toNumber(overviewRow?.total_views),
      uniqueVisitors: toNumber(overviewRow?.unique_visitors),
    },
    packages: ((packagesResult.data ?? []) as PackageAnalyticsRpcRow[]).map((row) => {
      const packageMeta = packageMetaById.get(row.tour_id)
      const packageSubmissionCounts =
        submissionCounts.byPackageId.get(row.tour_id) ??
        submissionCounts.byPackageName.get(row.package_title.trim().toLowerCase())

      return {
        bookings: packageSubmissionCounts?.bookings ?? 0,
        category: packageMeta?.category ?? '',
        durationDays: toNumber(packageMeta?.duration_days),
        imageUrl: packageMeta?.main_image_url || packageMeta?.hero_image_url || null,
        inquiries: packageSubmissionCounts?.inquiries ?? 0,
        packageSlug: row.package_slug,
        packageTitle: row.package_title,
        tourId: row.tour_id,
        uniqueVisitors: toNumber(row.unique_visitors),
        views: toNumber(row.views),
      }
    }),
    viewsOverTime: ((viewsOverTimeResult.data ?? []) as ViewsOverTimeRpcRow[]).map((row) => ({
      uniqueVisitors: toNumber(row.unique_visitors),
      viewDate: row.view_date,
      views: toNumber(row.views),
    })),
  }
}

