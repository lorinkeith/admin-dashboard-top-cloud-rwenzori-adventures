import { supabase } from '../lib/supabaseClient'
import type { TripAdvisorReview } from '../types/tripAdvisorReview'

type ImportResponse = {
  success: boolean
  reviews?: TripAdvisorReview[]
  insertedCount?: number
  skippedExisting?: number
  error?: string
}

const defaultImporterEndpoint = '/api/fetch-tripadvisor-reviews'

function getImporterEndpoint() {
  const configured = import.meta.env.VITE_REVIEW_IMPORT_API_URL as string | undefined
  if (configured) return configured

  if (import.meta.env.DEV) return defaultImporterEndpoint

  return defaultImporterEndpoint
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.')
  }

  return supabase
}

function validateTripAdvisorUrl(url: string) {
  let parsed: URL

  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Enter a valid TripAdvisor business URL.')
  }

  const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
  if (!host.startsWith('tripadvisor.')) {
    throw new Error('The URL must belong to TripAdvisor.')
  }
}

async function postImporter(payload: Record<string, unknown>) {
  const endpoint = getImporterEndpoint()
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()
  const accessToken = data.session?.access_token

  if (error) {
    throw new Error(error.message)
  }

  if (payload.publish && !accessToken) {
    throw new Error('You must be logged in to publish reviews.')
  }

  let response: Response

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    throw new Error(
      `Could not reach the review importer at ${endpoint}. Make sure the dashboard Pages Function is deployed, or restart the admin dev server for local testing.`,
      { cause: error },
    )
  }

  const result = (await response.json().catch(() => null)) as ImportResponse | null

  if (!response.ok || result?.success === false) {
    throw new Error(result?.error || 'Unable to import reviews.')
  }

  return result ?? { success: true, reviews: [] }
}

export async function fetchTripAdvisorReviewPreview(url: string) {
  const trimmedUrl = url.trim()
  validateTripAdvisorUrl(trimmedUrl)

  return postImporter({ url: trimmedUrl, publish: false })
}

export async function publishTripAdvisorReviews(url: string, reviews: TripAdvisorReview[]) {
  const trimmedUrl = url.trim()
  validateTripAdvisorUrl(trimmedUrl)

  return postImporter({ url: trimmedUrl, publish: true, reviews })
}

export async function getTripAdvisorReviews(): Promise<TripAdvisorReview[]> {
  const client = getSupabaseClient()
  const { data, error } = await client
    .from('tripadvisor_reviews')
    .select('*')
    .order('review_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data ?? []) as TripAdvisorReview[]
}
