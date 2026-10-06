import type { ReactNode } from 'react';
import type { SectionId } from '../../../utils/sectionAnchors';

interface SectionCardProps {
  id: SectionId;
  title: ReactNode;
  description?: ReactNode;
  /** buttons that belong to this section, shown top right */
  actions?: ReactNode;
  children: ReactNode;
}

/** One block of the preview page. Its id is the URL hash that points at it. */
export function SectionCard({ id, title, description, actions, children }: SectionCardProps) {
  return (
    <section id={id} className="card scroll-mt-4">
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
