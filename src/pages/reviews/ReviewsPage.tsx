import { useEffect, useState } from 'react'
import { FiExternalLink, FiRefreshCw, FiSend, FiStar } from 'react-icons/fi'
import PageHeader from '../../components/ui/PageHeader'
import {
  fetchTripAdvisorReviewPreview,
  getTripAdvisorReviews,
  publishTripAdvisorReviews,
} from '../../services/tripAdvisorReviewService'
import type { TripAdvisorReview } from '../../types/tripAdvisorReview'

const fallbackImage = '/src/assets/UFT-Favicon.png'

function formatDate(value: string | null | undefined) {
  if (!value) return 'Recently'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="flex justify-center gap-1" aria-label={`${rating} out of 5 rating`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={`grid h-4 w-4 place-items-center rounded-full ${index < rating ? 'bg-[#00aa6c]' : 'bg-[#d8e7df]'}`}>
          {index < rating ? <FiStar className="h-2.5 w-2.5 fill-white text-white" /> : null}
        </span>
      ))}
    </span>
  )
}

function ReviewCard({ review }: { review: TripAdvisorReview }) {
  return (
    <article className="relative flex min-h-64 flex-col items-center rounded-2xl bg-[#f4f4f4] px-7 pb-7 pt-12 text-center text-slate-950">
      <div className="absolute -top-8">
        <div className="relative">
          <img
            className="h-16 w-16 rounded-full object-cover"
            src={review.author_image || fallbackImage}
            alt={`${review.author_name} profile`}
            onError={(event) => {
              event.currentTarget.src = fallbackImage
            }}
          />
          <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-[#00aa6c] text-[0.65rem] font-black text-white">
            TA
          </span>
        </div>
      </div>
      <h3 className="mt-1 text-base font-black">{review.author_name || 'TripAdvisor traveler'}</h3>
      <p className="mt-1 text-sm text-slate-500">{formatDate(review.review_date)}</p>
      <div className="mt-4"><ReviewStars rating={review.rating || 5} /></div>
      <p className="mt-4 line-clamp-4 text-base leading-7">{review.review_text}</p>
      <button className="mt-auto pt-4 text-sm font-semibold text-slate-400" type="button">
        Read more
      </button>
    </article>
  )
}

function ReviewsPage() {
  const [url, setUrl] = useState('')
  const [previewReviews, setPreviewReviews] = useState<TripAdvisorReview[]>([])
  const [liveReviews, setLiveReviews] = useState<TripAdvisorReview[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isFetching, setIsFetching] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isLoadingLive, setIsLoadingLive] = useState(true)

  const loadLiveReviews = async () => {
    setIsLoadingLive(true)
    try {
      setLiveReviews(await getTripAdvisorReviews())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load live reviews.')
    } finally {
      setIsLoadingLive(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLiveReviews(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const fetchReviews = async () => {
    setIsFetching(true)
    setError('')
    setMessage('')

    try {
      const result = await fetchTripAdvisorReviewPreview(url)
      const reviews = result.reviews ?? []

      if (reviews.length === 0) {
        setPreviewReviews([])
        setError(result.skippedExisting ? 'All reviews from that page already exist on the live site.' : 'No reviews were found.')
        return
      }

      setPreviewReviews(reviews)
      setMessage(`Found ${reviews.length} new review${reviews.length === 1 ? '' : 's'} ready to preview.`)
    } catch (fetchError) {
      setPreviewReviews([])
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to fetch reviews.')
    } finally {
      setIsFetching(false)
    }
  }

  const publishReviews = async () => {
    if (previewReviews.length === 0) {
      setError('Fetch reviews first, then publish them.')
      return
    }

    setIsPublishing(true)
    setError('')
    setMessage('')

    try {
      const result = await publishTripAdvisorReviews(url, previewReviews)
      setPreviewReviews([])
      setMessage(`Updated live site with ${result.insertedCount ?? 0} new review${result.insertedCount === 1 ? '' : 's'}.`)
      await loadLiveReviews()
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : 'Unable to update live site.')
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Reviews"
        description="Import TripAdvisor reviews, preview them, and publish new reviews to the public website."
        action={
          <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-admin-border bg-white px-4 text-sm font-bold text-admin-dark hover:border-emerald-200 hover:text-emerald-700" href={url || 'https://www.tripadvisor.com/'} target="_blank" rel="noreferrer">
            Open TripAdvisor <FiExternalLink />
          </a>
        }
      />

      <section className="rounded-2xl border border-admin-border bg-white p-5 shadow-sm">
        <label className="text-sm font-bold text-admin-dark" htmlFor="tripadvisor-url">TripAdvisor Business URL</label>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <input
            id="tripadvisor-url"
            className="min-h-12 flex-1 rounded-xl border border-admin-border px-4 text-sm outline-none transition focus:border-admin-accent focus:ring-4 focus:ring-brand-100"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.tripadvisor.com/Attraction_Review-..."
          />
          <button
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-admin-accent px-5 text-sm font-black text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isFetching || !url.trim()}
            onClick={fetchReviews}
          >
            <FiRefreshCw className={isFetching ? 'animate-spin' : ''} />
            {isFetching ? 'Fetching...' : 'Fetch & Import Reviews'}
          </button>
        </div>

        {error ? <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</p> : null}
      </section>

      <section className="mt-7 rounded-2xl border border-admin-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-admin-dark">Preview imported reviews</h2>
            <p className="mt-1 text-sm text-admin-muted">These cards are not live until you publish them.</p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={isPublishing || previewReviews.length === 0}
            onClick={publishReviews}
          >
            <FiSend />
            {isPublishing ? 'Publishing...' : 'Update Live Site'}
          </button>
        </div>

        {previewReviews.length > 0 ? (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {previewReviews.map((review) => <ReviewCard key={review.review_id} review={review} />)}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-admin-border bg-admin-bg p-8 text-center text-sm text-admin-muted">
            Imported review previews will appear here.
          </div>
        )}
      </section>

      <section className="mt-7 rounded-2xl border border-admin-border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-admin-dark">Live website reviews</h2>
        {isLoadingLive ? (
          <p className="mt-4 text-sm text-admin-muted">Loading live reviews...</p>
        ) : liveReviews.length > 0 ? (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {liveReviews.slice(0, 6).map((review) => <ReviewCard key={review.review_id} review={review} />)}
          </div>
        ) : (
          <p className="mt-4 rounded-2xl bg-admin-bg p-6 text-sm text-admin-muted">No live reviews have been imported yet.</p>
        )}
      </section>
    </div>
  )
}

export default ReviewsPage
