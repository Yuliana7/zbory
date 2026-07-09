import type { IconProps } from './types';

export function SaveIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h9.172a2 2 0 011.414.586l1.828 1.828A2 2 0 0120 6.828V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4v4h8V4" />
    </svg>
  );
}
