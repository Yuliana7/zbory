import { forwardRef } from 'react';
import type { Aggregates } from '../../types';
import { generateThankYouMessage } from '../../utils/insightGenerator';

interface ThankYouCardProps {
  aggregates: Aggregates;
  format?: 'post' | 'story';
}

export const ThankYouCard = forwardRef<HTMLDivElement, ThankYouCardProps>(({ aggregates, format = 'post' }, ref) => {
  const isStory = format === 'story';
  const message = generateThankYouMessage(aggregates.totalAmount, aggregates.donationCount);
  const formattedTotal = new Intl.NumberFormat('uk-UA').format(Math.round(aggregates.totalAmount));

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: isStory ? 1920 : 1080,
        background: 'linear-gradient(145deg, #1d3461 0%, #1a237e 50%, #0d1b4b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isStory ? '120px 80px' : '80px',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: '#ffffff',
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 65%)',
          pointerEvents: 'none',
        }}
      />

      {/* Corner decorations */}
      {[
        { top: 40, left: 40 },
        { top: 40, right: 40 },
        { bottom: 40, left: 40 },
        { bottom: 40, right: 40 },
      ].map((pos, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: 40,
            height: 40,
            ...pos,
            opacity: 0.3,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 3,
              background: '#fbbf24',
              position: 'absolute',
              top: i < 2 ? 0 : 'auto',
              bottom: i >= 2 ? 0 : 'auto',
            }}
          />
          <div
            style={{
              height: '100%',
              width: 3,
              background: '#fbbf24',
              position: 'absolute',
              left: i % 2 === 0 ? 0 : 'auto',
              right: i % 2 === 1 ? 0 : 'auto',
            }}
          />
        </div>
      ))}

      {/* Hearts */}
      <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 32 }}>💙💛</div>

      {/* ДЯКУЄМО */}
      <div
        style={{
          fontSize: 96,
          fontWeight: 900,
          letterSpacing: '8px',
          textTransform: 'uppercase',
          background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          marginBottom: 24,
        }}
      >
        Дякуємо
      </div>

      {/* Amount */}
      <div
        style={{
          fontSize: 72,
          fontWeight: 800,
          letterSpacing: '-2px',
          color: '#ffffff',
          marginBottom: 8,
        }}
      >
        {formattedTotal} ₴
      </div>
      <div
        style={{
          fontSize: 30,
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 48,
        }}
      >
        зібрано разом
      </div>

      {/* Message */}
      <div
        style={{
          fontSize: 32,
          lineHeight: 1.5,
          color: 'rgba(255,255,255,0.8)',
          maxWidth: 840,
          marginBottom: 64,
        }}
      >
        {message}
      </div>

      {/* Donors count pill */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 100,
          padding: '20px 48px',
        }}
      >
        <span style={{ fontSize: 28, color: 'rgba(255,255,255,0.5)' }}>Небайдужих людей:</span>
        <span style={{ fontSize: 40, fontWeight: 800, color: '#fbbf24' }}>
          {aggregates.donationCount}
        </span>
      </div>

      {/* Branding */}
      <div
        style={{
          position: 'absolute',
          bottom: 56,
          fontSize: 22,
          color: 'rgba(255,255,255,0.3)',
          letterSpacing: '2px',
        }}
      >
        ZBORY • ЗБОРИ
      </div>

      {/* UA flag bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 8,
          background: 'linear-gradient(90deg, #005BBB 50%, #FFD500 50%)',
        }}
      />
    </div>
  );
});
