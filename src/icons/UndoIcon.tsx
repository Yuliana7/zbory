import type { IconProps } from './types';

export function UndoIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 010 11H11" />
    </svg>
  );
}
