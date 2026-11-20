import type { IconProps } from './types';

export function ChartIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20h16M7 20v-6M12 20V8M17 20v-9" />
    </svg>
  );
}
