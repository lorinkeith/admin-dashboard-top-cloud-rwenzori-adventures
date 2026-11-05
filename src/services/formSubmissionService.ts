import { supabase } from '../lib/supabaseClient'
import type {
  FormSubmission,
  FormSubmissionStatus,
  SubmissionDateFilter,
  SubmissionTypeFilter,
} from '../types/formSubmission'

export type GetFormSubmissionsOptions = {
  page: number
  pageSize: number
  type: SubmissionTypeFilter
  dateFilter: SubmissionDateFilter
  search: string
}

export type FormSubmissionsResult = {
  submissions: FormSubmission[]
  count: number
}

export type NewSubmissionCounts = {
  bookings: number
  inquiries: number
}

export type NewSubmissionBadgeItem = {
  id: string
  type: 'booking' | 'inquiry'
}

function getSupabaseClient() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.',
    )
  }

  return supabase
}

function getReadableSupabaseError(error: { message: string } | null) {
  if (!error) return ''

  if (error.message.toLowerCase().includes('row-level security')) {
    return 'Permission denied. Please check Supabase RLS policies for form_submissions.'
  }

  return error.message
}

function throwIfSupabaseError(error: { message: string } | null) {
  const message = getReadableSupabaseError(error)

  if (message) {
    throw new Error(message)
  }
}

async function requireAuthenticatedUser() {
  const client = getSupabaseClient()
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw new Error(error.message)
  }

  if (!data.session) {
    throw new Error('You must be logged in to manage form submissions.')
  }

  return client
}

function getDateCutoff(filter: SubmissionDateFilter) {
  if (filter === 'all') return null

  const days = filter === '7d' ? 7 : 30
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return cutoff.toISOString()
}

function escapeSearchValue(value: string) {
  return value.replace(/[,%]/g, (match) => `\\${match}`)
}

export async function getFormSubmissions({
  page,
  pageSize,
  type,
  dateFilter,
  search,
}: GetFormSubmissionsOptions): Promise<FormSubmissionsResult> {
  const client = await requireAuthenticatedUser()
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const trimmedSearch = search.trim()

  let query = client
    .from('form_submissions')
    .select('*,tour_packages(title)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (type !== 'all') {
    query = query.eq('type', type)
  }

  const cutoff = getDateCutoff(dateFilter)
  if (cutoff) {
    query = query.gte('created_at', cutoff)
  }

  if (trimmedSearch) {
    const term = `%${escapeSearchValue(trimmedSearch)}%`
    query = query.or(
      [
        `full_name.ilike.${term}`,
        `email.ilike.${term}`,
        `phone.ilike.${term}`,
        `tour_package_name.ilike.${term}`,
        `message.ilike.${term}`,
        `special_requests.ilike.${term}`,
      ].join(','),
    )
  }

  const { data, error, count } = await query

  throwIfSupabaseError(error)

  return {
    submissions: (data ?? []) as FormSubmission[],
    count: count ?? 0,
  }
}

export async function getNewSubmissionBadgeItems(): Promise<NewSubmissionBadgeItem[]> {
  const client = await requireAuthenticatedUser()
  const { data, error } = await client
    .from('form_submissions')
    .select('id,type')
    .eq('status', 'new')

  throwIfSupabaseError(error)

  return (data ?? []) as NewSubmissionBadgeItem[]
}

export async function getNewSubmissionCounts(): Promise<NewSubmissionCounts> {
  const items = await getNewSubmissionBadgeItems()

  return {
    bookings: items.filter((item) => item.type === 'booking').length,
    inquiries: items.filter((item) => item.type === 'inquiry').length,
  }
}

export async function updateFormSubmissionStatus(
  id: string,
  status: FormSubmissionStatus,
): Promise<FormSubmission> {
  const client = await requireAuthenticatedUser()
  const { data, error } = await client
    .from('form_submissions')
    .update({ status })
    .eq('id', id)
    .select('*,tour_packages(title)')
    .single()

  throwIfSupabaseError(error)

  if (!data) {
    throw new Error('Submission was not updated.')
  }

  return data as FormSubmission
}

export async function deleteFormSubmission(id: string): Promise<void> {
  const client = await requireAuthenticatedUser()
  const { error } = await client.from('form_submissions').delete().eq('id', id)

  throwIfSupabaseError(error)
}

export async function deleteFormSubmissions(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const client = await requireAuthenticatedUser()
  const { error } = await client.from('form_submissions').delete().in('id', ids)

  throwIfSupabaseError(error)
}
