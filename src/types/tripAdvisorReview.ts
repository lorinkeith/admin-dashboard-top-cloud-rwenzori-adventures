export type TripAdvisorReview = {
  id?: string
  review_id: string
  author_name: string
  author_image: string | null
  rating: number
  review_text: string
  review_date: string | null
  created_at?: string
}
