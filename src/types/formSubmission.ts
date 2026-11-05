export type FormSubmissionType = 'booking' | 'inquiry'

export type FormSubmissionStatus = 'new' | 'processed'

export type FormSubmission = {
  id: string
  type: FormSubmissionType
  status: FormSubmissionStatus
  package_id: string | null
  tour_package_name: string | null
  full_name: string
  email: string
  phone: string
  country: string | null
  preferred_travel_date: string | null
  date_flexible: boolean | null
  adults: number | null
  children: number | null
  children_ages: string | null
  accommodation_preference: string | null
  estimated_budget: string | null
  budget_per_person: string | null
  estimated_group_budget: string | null
  currency: string | null
  travelers: number | null
  message: string | null
  special_requests: string | null
  raw_payload: Record<string, unknown>
  created_at: string
  updated_at: string
  tour_packages?: {
    title: string | null
  } | null
}

export type SubmissionTypeFilter = 'all' | FormSubmissionType
export type SubmissionDateFilter = 'all' | '7d' | '30d'

