import type { ReactNode } from 'react';

interface SectionCardProps {
  title: ReactNode;
  description?: ReactNode;
  /** buttons that belong to this section, shown top right */
  actions?: ReactNode;
  children: ReactNode;
}

/** The always-open block of the preview page (the data itself). */
export function SectionCard({ title, description, actions, children }: SectionCardProps) {
  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-gray-500">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
