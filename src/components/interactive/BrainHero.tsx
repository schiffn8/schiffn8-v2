import { useState, useCallback, useEffect, useRef } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

const CAROUSEL_INTERVAL = 2800; // ms per slide

// ─── Background carousel ─────────────────────────────────────────────────────

function DesignCarousel({ images, visible }: { images: string[]; visible: boolean }) {
  const [idx, setIdx] = useState(0);

  // Always cycling — feels "live" when the design zone is entered mid-cycle
  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(
      () => setIdx(i => (i + 1) % images.length),
      CAROUSEL_INTERVAL
    );
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transition: 'opacity 1s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {images.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          aria-hidden="true"
          loading={i === 0 ? 'eager' : 'lazy'}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            opacity: i === idx ? 1 : 0,
            transition: 'opacity 1.1s cubic-bezier(0.22, 1, 0.36, 1)',
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Subtle dark vignette so project images don't overpower the brain */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  thumbs?: string[];
}

export default function BrainHero({ thumbs = [] }: Props) {
  const [zone,   setZone]   = useState<Zone>(null);
  const [labels, setLabels] = useState({ design: 0, ai: 0, astrion: 0 });

  const getZone = (nx: number): Zone =>
    nx < 0.33 ? 'design' : nx > 0.66 ? 'astrion' : 'ai';

  const handleMouseX = useCallback((nx: number) => {
    const z = getZone(nx);
    setZone(z);
    setLabels({ design: 0, ai: 0, astrion: 0, [z]: 1 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setZone(null);
    setLabels({ design: 0, ai: 0, astrion: 0 });
  }, []);

  const handleClick = useCallback(() => {
    if (zone) window.location.href = ROUTES[zone];
  }, [zone]);

  const handleTouchEnd = useCallback(() => {
    if (zone) window.location.href = ROUTES[zone];
  }, [zone]);

  const inDesign = zone === 'design';

  return (
    <div
      style={{
        width: '100vw', height: '100dvh',
        background: '#000', position: 'relative', overflow: 'hidden',
        cursor: zone ? 'pointer' : 'crosshair',
      }}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
    >
      {/* Layer 1: design project carousel (behind brain) */}
      <DesignCarousel images={thumbs} visible={inDesign} />

      {/* Layer 2: brain video — fades transparent over carousel in design zone */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: inDesign ? 0.28 : 1,
          transition: 'opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <MouseScrub
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          onMouseX={handleMouseX}
          onMouseLeave={handleMouseLeave}
        />
      </div>

      {/* Layer 3: zone labels */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          alignItems: 'flex-end', padding: '0 6% 7%',
        }}
      >
        {(['design', 'ai', 'astrion'] as const).map((z) => (
          <span
            key={z}
            style={{
              display: 'block',
              textAlign: z === 'design' ? 'left' : z === 'astrion' ? 'right' : 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(0.65rem, 1.2vw, 0.85rem)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: COLORS[z],
              opacity: labels[z],
              transition: 'opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              userSelect: 'none',
            }}
          >
            {z}
          </span>
        ))}
      </div>

      {/* Screen-reader nav */}
      <nav
        aria-label="Portfolio sections"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        <a href="/work">Design Work</a>
        <a href="/ai">AI Work</a>
        <a href="/astrion">Astrion</a>
      </nav>
    </div>
  );
}
