import { useId } from 'react';

/** The app's mark: two coins with ₴ and a sparkle, white on the brand gradient (indigo-900 → indigo-600, same as tailwind.config.js). Drawn as paths
 * (no font) and mirrored in public/icon.svg and the PWA PNGs, so the header, the favicon and the
 * home-screen icon are the same picture. Size it with `className`.
 * Two tones only: the shapes that hide the lines behind them are filled with the tile's own gradient,
 * fixed to the tile (userSpaceOnUse), so they match it exactly. */
export function AppLogo({ className }: { className?: string }) {
  const id = useId() + 'g';
  const g = `url(#${id})`;
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="512" y2="512">
          <stop offset="0%" stopColor="#312E81" />
          <stop offset="100%" stopColor="#4F46E5" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="110" fill={g} />
      <g fill={g} stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="222" cy="292" r="146" />
        <circle cx="222" cy="292" r="112" strokeWidth="7" />
        <circle cx="288" cy="240" r="146" fill="#fff" />
        <circle cx="288" cy="240" r="114" fill="none" stroke={g} strokeWidth="8" />
        <path fill={g} stroke="none" transform="translate(203.25 126.9) scale(.52)" d="M226.8,197.6l-49.1,39.7h144.2v43.9h-187c-12.5,9.4-19.9,20.9-19.9,35.5c0,25.1,19.9,38.7,55.4,38.7   c30.3,0,56.4-14.6,77.3-44.9l57.5,38.7c-31.3,48.1-87.8,72.1-141.1,72.1c-70,0-122.2-33.4-122.2-88.8c0-17.8,6.3-36.6,18.8-51.2   H3.2v-43.9h91.9l50.2-39.7H3.2v-43.9h186c13.6-12.5,19.9-24,19.9-37.6c0-21.9-19.9-37.6-50.2-37.6c-29.3,0-54.3,16.7-72.1,44.9   L31.4,85.8c30.3-48.1,79.4-72.1,132.7-72.1c72.1,0,119.1,37.6,119.1,88.8c0,18.8-6.3,37.6-16.7,51.2h55.4v43.9H226.8z" />
        <path d="M98,60 Q106.4,89.6 136,98 Q106.4,106.4 98,136 Q89.6,106.4 60,98 Q89.6,89.6 98,60 Z" />
        <path d="M422,398 Q426.8,415.2 444,420 Q426.8,424.8 422,442 Q417.2,424.8 400,420 Q417.2,415.2 422,398 Z" />
      </g>
    </svg>
  );
}
