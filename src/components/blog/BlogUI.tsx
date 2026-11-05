import ExistingPageHeader from '../ui/PageHeader';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <ExistingPageHeader title={title} description={description || eyebrow} action={action} />;
}

export function Button({ children, type = 'button', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type={type} className={`inline-flex h-10 items-center justify-center rounded-[10px] bg-brand-500 px-4 text-sm font-bold text-white hover:-translate-y-px hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/50 disabled:hover:translate-y-0 ${className}`} {...props}>
      {children}
    </button>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-admin-border bg-white p-6 text-center">
      <h2 className="text-base font-bold text-admin-dark">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-admin-muted">{description}</p>
    </div>
  );
}
