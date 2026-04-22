import { useState, useCallback, useRef, useEffect } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

// Drop your zone animation videos at these paths.
// Each plays (looped, muted) when the cursor rests in that zone for 500ms,
// replacing the frozen scrub frame. Use black-background + bright content
// so mix-blend-mode:screen makes the black areas transparent, matching the
// brain video layer.
const ZONE_VIDEOS: Record<NonNullable<Zone>, string> = {
  design:  '/videos/zone-design.mp4',
  ai:      '/videos/zone-ai.mp4',
  astrion: '/videos/zone-astrion.mp4',
};

// ─── Cursor bubble ────────────────────────────────────────────────────────────

function CursorBubble() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e: MouseEvent) => {
      el.style.transform = `translate(${e.clientX - 29}px, ${e.clientY - 29}px)`;
    };
    window.addEventListener('mousemove', move, { passive: true });
    return () => window.removeEventListener('mousemove', move);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         58,
        height:        58,
        borderRadius:  '50%',
        background:    '#fff',
        mixBlendMode:  'difference',
        pointerEvents: 'none',
        transform:     'translate(-120px, -120px)',
        zIndex:        9999,
        willChange:    'transform',
      }}
    />
  );
}

// ─── Zone animation videos ────────────────────────────────────────────────────

// All three videos are kept in the DOM so they're buffered; only the active
// one is visible. On settle: play from start and fade in. On leave: fade out
// and pause. The brain scrub layer cross-fades with these via opacity.
function ZoneVideo({ settledZone }: { settledZone: Zone }) {
  const refs = useRef<Partial<Record<NonNullable<Zone>, HTMLVideoElement>>>({});

  useEffect(() => {
    const zones = Object.keys(ZONE_VIDEOS) as NonNullable<Zone>[];
    zones.forEach((z) => {
      const vid = refs.current[z];
      if (!vid) return;
      if (z === settledZone) {
        vid.currentTime = 0;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });
  }, [settledZone]);

  return (
    <>
      {(Object.keys(ZONE_VIDEOS) as NonNullable<Zone>[]).map((z) => (
        <video
          key={z}
          ref={el => { if (el) refs.current[z] = el; }}
          src={ZONE_VIDEOS[z]}
          muted
          playsInline
          loop
          preload="auto"
          aria-hidden="true"
          style={{
            position:      'absolute',
            inset:         0,
            width:         '100%',
            height:        '100%',
            objectFit:     'cover',
            display:       'block',
            pointerEvents: 'none',
            mixBlendMode:  'screen',
            zIndex:        1,
            opacity:       settledZone === z ? 1 : 0,
            transition:    'opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      ))}
    </>
  );
}

// ─── Project image grid ───────────────────────────────────────────────────────

function ProjectGrid({ images }: { images: string[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div
      aria-hidden="true"
      style={{
        position:            'absolute',
        top:                 0,
        left:                0,
        width:               '33.33vw',
        height:              '100dvh',
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows:    '1fr 1fr 1fr',
        zIndex:              3,
      }}
    >
      {images.slice(0, 6).map((src, i) => (
        <div
          key={i}
          style={{ overflow: 'hidden', position: 'relative' }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <img
            src={src}
            alt=""
            style={{
              width:      '100%',
              height:     '100%',
              objectFit:  'cover',
              display:    'block',
              opacity:    hoveredIdx === i ? 1 : 0,
              transform:  hoveredIdx === i ? 'scale(1.05)' : 'scale(1)',
              transition: 'opacity 0.32s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
              willChange: 'opacity, transform',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  thumbs?: string[];
}

export default function BrainHero({ thumbs = [] }: Props) {
  const [zone,        setZone]        = useState<Zone>(null);
  const [settledZone, setSettledZone] = useState<Zone>(null);
  const [labels,      setLabels]      = useState({ design: 0, ai: 0, astrion: 0 });
  const cursorXRef = useRef<number>(0.5);

  // Clear settled immediately on any zone change, then re-settle after 500ms of stillness.
  // This ensures the animation video stops the moment the cursor moves.
  useEffect(() => {
    setSettledZone(null);
    if (!zone) return;
    const t = setTimeout(() => setSettledZone(zone), 500);
    return () => clearTimeout(t);
  }, [zone]);

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

  return (
    <div
      style={{
        width: '100vw', height: '100dvh',
        background: '#000', position: 'relative', overflow: 'hidden',
        cursor: 'none',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
    >
      {/* Layer 1a — scrubbed brain (fades out when animation takes over) */}
      <div
        style={{
          position:      'absolute',
          inset:         0,
          mixBlendMode:  'screen',
          pointerEvents: 'none',
          zIndex:        1,
          opacity:       settledZone ? 0 : 1,
          transition:    'opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <MouseScrub src={VIDEO_SRC} poster={POSTER_SRC} cursorXRef={cursorXRef} />
      </div>

      {/* Layer 1b — zone animation videos (fade in when settled, replace the scrub) */}
      <ZoneVideo settledZone={settledZone} />

      {/* Layer 2 — 2×3 project image grid (left third) */}
      <ProjectGrid images={thumbs} />

      {/* Layer 3 — zone labels */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          alignItems: 'flex-end', padding: '0 6% 7%',
          zIndex: 5,
        }}
      >
        {(['design', 'ai', 'astrion'] as const).map((z) => (
          <span
            key={z}
            style={{
              display:       'block',
              textAlign:     z === 'design' ? 'left' : z === 'astrion' ? 'right' : 'center',
              fontFamily:    'var(--font-mono)',
              fontSize:      'clamp(0.65rem, 1.2vw, 0.85rem)',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color:         COLORS[z],
              opacity:       labels[z],
              transition:    'opacity 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
              userSelect:    'none',
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

      <CursorBubble />
    </div>
  );
}
