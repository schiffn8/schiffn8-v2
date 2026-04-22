import { useState, useCallback, useRef } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

// ─── Project image grid ───────────────────────────────────────────────────────

// 6 staggered positions across the left third of the viewport.
// `origin` controls which corner stays anchored when the image expands.
const GRID_POS = [
  { top: '11%', left: '2%',  rotate: '-2.1deg', origin: 'top left'    },
  { top:  '8%', left: '12%', rotate:  '1.4deg', origin: 'top left'    },
  { top: '35%', left: '1%',  rotate:  '1.0deg', origin: 'top left'    },
  { top: '32%', left: '13%', rotate: '-1.7deg', origin: 'top left'    },
  { top: '59%', left: '2%',  rotate:  '1.8deg', origin: 'bottom left' },
  { top: '55%', left: '11%', rotate: '-1.0deg', origin: 'bottom left' },
] as const;

// scale(5) expands a 10vw image to 50vw — exactly 1/4 of a 16:9 viewport area
const THUMB_W    = 10;  // vw
const SCALE_FULL = 5;

function ProjectGrid({ images, active }: { images: string[]; active: boolean }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div
      aria-hidden="true"
      style={{
        position:      'absolute',
        inset:         0,
        pointerEvents: active ? 'auto' : 'none',
        opacity:       active ? 1 : 0,
        transition:    'opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {images.map((src, i) => {
        const pos       = GRID_POS[i % GRID_POS.length];
        const isHovered = hoveredIdx === i;
        const isDimmed  = hoveredIdx !== null && !isHovered;

        return (
          <img
            key={i}
            src={src}
            alt=""
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{
              position:        'absolute',
              top:             pos.top,
              left:            pos.left,
              width:           `${THUMB_W}vw`,
              aspectRatio:     '16 / 9',
              objectFit:       'cover',
              display:         'block',
              borderRadius:    '3px',
              transformOrigin: pos.origin,
              transform:       isHovered
                ? `rotate(0deg) scale(${SCALE_FULL})`
                : `rotate(${pos.rotate}) scale(1)`,
              opacity:  isHovered ? 1 : isDimmed ? 0.07 : 0.26,
              zIndex:   isHovered ? 15 : isDimmed ? 0 : i + 1,
              transition:
                'transform 0.52s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.38s ease',
              willChange: 'transform, opacity',
              cursor:     'pointer',
            }}
          />
        );
      })}
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

  // Shared ref drives MouseScrub without triggering re-renders on every mousemove
  const cursorXRef = useRef<number>(0.5);

  const getZone = (nx: number): Zone =>
    nx < 0.33 ? 'design' : nx > 0.66 ? 'astrion' : 'ai';

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    cursorXRef.current = nx;
    const z = getZone(nx);
    setZone(z);
    setLabels({ design: 0, ai: 0, astrion: 0, [z]: 1 });
  }, []);

  const handleMouseLeave = useCallback(() => {
    cursorXRef.current = 0.5;
    setZone(null);
    setLabels({ design: 0, ai: 0, astrion: 0 });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    cursorXRef.current = nx;
    const z = getZone(nx);
    setZone(z);
    setLabels({ design: 0, ai: 0, astrion: 0, [z]: 1 });
  }, []);

  const handleClick    = useCallback(() => { if (zone) window.location.href = ROUTES[zone]; }, [zone]);
  const handleTouchEnd = useCallback(() => { if (zone) window.location.href = ROUTES[zone]; }, [zone]);

  const inDesign = zone === 'design';

  return (
    <div
      style={{
        width: '100vw', height: '100dvh',
        background: '#000', position: 'relative', overflow: 'hidden',
        cursor: zone ? 'pointer' : 'crosshair',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
    >
      {/* Layer 1 — project image grid; events pass through brain wrapper above */}
      <ProjectGrid images={thumbs} active={inDesign} />

      {/* Layer 2 — brain video (screen blend; pointer-events:none so grid gets hover) */}
      <div
        style={{
          position: 'absolute', inset: 0,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      >
        <MouseScrub src={VIDEO_SRC} poster={POSTER_SRC} cursorXRef={cursorXRef} />
      </div>

      {/* Layer 3 — zone labels */}
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
