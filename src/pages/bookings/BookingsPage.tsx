import { SubmissionsPageView } from '../../components/submissions/SubmissionsPageView'

function BookingsPage() {
  return (
    <SubmissionsPageView
      type="booking"
      title="Bookings"
      description="Review tour booking requests from travelers and prepare thoughtful follow-ups."
      emptyTitle="No booking requests yet"
      emptyDescription="New booking requests from the public website will appear here."
    />
  )
}

export default BookingsPage
