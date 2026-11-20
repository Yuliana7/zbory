import type { IconProps } from './types';

export function ArchiveIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16a1 1 0 011 1v3H3V6a1 1 0 011-1zM5 9v10a1 1 0 001 1h12a1 1 0 001-1V9M10 13h4" />
    </svg>
  );
}
