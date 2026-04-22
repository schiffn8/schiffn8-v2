import { useState, useCallback, useEffect, useRef } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

const SPAWN_INTERVAL = 1400;  // ms between each new drop
const DROP_DURATION  = 3600;  // ms for full top→bottom fall
const COLS           = 6;
const COL_W          = 100 / COLS;   // 16.67vw per column
const IMG_W          = COL_W * 0.72; // ~12vw — narrower than 1/6 viewport ✓

// ─── Raining project images ───────────────────────────────────────────────────

interface Drop {
  id:       number;
  src:      string;
  col:      number;   // 0–5
  xJitter:  number;   // vw offset within column for variation
  duration: number;   // ms — slight per-drop variation
}

function RainingImages({ images, active }: { images: string[]; active: boolean }) {
  const [drops, setDrops]   = useState<Drop[]>([]);
  const nextId   = useRef(0);
  const nextCol  = useRef(0);
  const nextImg  = useRef(0);

  useEffect(() => {
    if (!active || images.length === 0) return;

    const spawn = () => {
      const col      = nextCol.current % COLS;
      const imgIdx   = nextImg.current % images.length;
      const id       = nextId.current;
      const duration = DROP_DURATION + (Math.random() - 0.5) * 800; // ±400ms variety
      const xJitter  = (Math.random() - 0.5) * 3;                   // ±1.5vw lateral jitter

      nextCol.current++;
      nextImg.current++;
      nextId.current++;

      setDrops(prev => [...prev, { id, src: images[imgIdx], col, xJitter, duration }]);

      // Remove after animation finishes
      setTimeout(() => {
        setDrops(prev => prev.filter(d => d.id !== id));
      }, duration + 100);
    };

    spawn(); // first drop immediately on zone entry
    const interval = setInterval(spawn, SPAWN_INTERVAL);
    return () => clearInterval(interval);
  }, [active, images]);

  if (drops.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      {drops.map(drop => {
        // Center image within its column, then apply jitter
        const leftVw = drop.col * COL_W + (COL_W - IMG_W) / 2 + drop.xJitter;

        return (
          <img
            key={drop.id}
            src={drop.src}
            alt=""
            loading="lazy"
            style={{
              position:  'absolute',
              top:       0,
              left:      `${leftVw}vw`,
              width:     `${IMG_W}vw`,
              height:    'auto',
              display:   'block',
              animation: `rain-drop ${drop.duration}ms ease-in forwards`,
              willChange: 'transform, opacity',
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
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
    >
      {/* Layer 1 — raining project images (design zone only) */}
      <RainingImages images={thumbs} active={inDesign} />

      {/* Layer 2 — brain video, screen-blended so black bg is transparent */}
      <div
        style={{
          position: 'absolute', inset: 0,
          mixBlendMode: 'screen',
        }}
      >
        <MouseScrub
          src={VIDEO_SRC}
          poster={POSTER_SRC}
          onMouseX={handleMouseX}
          onMouseLeave={handleMouseLeave}
        />
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
