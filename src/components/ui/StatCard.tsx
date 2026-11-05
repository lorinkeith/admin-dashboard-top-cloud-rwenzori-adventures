type StatCardProps = {
  label: string
  value: string
  note: string
}

function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="rounded-lg border border-admin-border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-admin-muted">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-admin-dark">{value}</p>
      <p className="mt-2 text-sm text-admin-muted">{note}</p>
    </article>
  )
}

export default StatCard
