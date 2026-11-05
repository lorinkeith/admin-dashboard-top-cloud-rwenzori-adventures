type EmptyStateProps = {
  title: string
  description: string
  action?: React.ReactNode
}

function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-admin-border bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto mb-5 h-12 w-12 rounded-full bg-brand-100" />
      <h2 className="text-lg font-semibold text-admin-dark">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-admin-muted">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

export default EmptyState
