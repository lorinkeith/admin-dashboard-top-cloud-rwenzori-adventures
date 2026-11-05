import type { ReactNode } from 'react'

type PageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
}

function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold text-admin-dark">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-admin-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="w-full min-w-0 shrink-0 sm:w-auto">{action}</div> : null}
    </div>
  )
}

export default PageHeader
