import { SubmissionsPageView } from '../../components/submissions/SubmissionsPageView'

function InquiriesPage() {
  return (
    <SubmissionsPageView
      type="inquiry"
      title="Inquiries"
      description="Read contact messages from potential travelers and respond with care."
      emptyTitle="No inquiries yet"
      emptyDescription="New inquiry messages from the public website will appear here."
    />
  )
}

export default InquiriesPage
