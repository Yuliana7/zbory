interface CountdownRingProps {
  secondsLeft: number;
  totalSeconds: number;
  className?: string;
}

/** A ring that drains as the wait runs out. The caller ticks once a second; the 1 s linear
 * transition turns those ticks into a smooth sweep instead of a stepped jump. */
export function CountdownRing({ secondsLeft, totalSeconds, className }: CountdownRingProps) {
  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const remaining = Math.max(0, Math.min(1, secondsLeft / totalSeconds));
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r={radius} stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <circle
        cx="12"
        cy="12"
        r={radius}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - remaining)}
        transform="rotate(-90 12 12)"
        style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
}
