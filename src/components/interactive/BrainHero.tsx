import { useState, useCallback, useEffect, useRef } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

// ─── 3D Carousel ─────────────────────────────────────────────────────────────

interface Item { id: number; src: string; }

// 7 positions: 0 = entering right (off-screen), 1–2 = right side, 3 = center,
// 4–5 = left side, 6 = exiting left (off-screen).
// Queue advances right → left: items shift from index 6 → 0 over time.
const SLOTS = [
  { x: -88, scale: 0.40, ry:  62, opacity: 0,    zIdx: 0 },  // off-screen left
  { x: -44, scale: 0.62, ry:  40, opacity: 0.36, zIdx: 1 },  // far left
  { x: -22, scale: 0.80, ry:  21, opacity: 0.68, zIdx: 2 },  // near left
  { x:   0, scale: 1.00, ry:   0, opacity: 1.00, zIdx: 4 },  // center
  { x:  22, scale: 0.80, ry: -21, opacity: 0.68, zIdx: 2 },  // near right
  { x:  44, scale: 0.62, ry: -40, opacity: 0.36, zIdx: 1 },  // far right
  { x:  88, scale: 0.40, ry: -62, opacity: 0,    zIdx: 0 },  // off-screen right
] as const;

const CARD_W     = 28;               // vw
const CARD_H     = CARD_W * 9 / 16; // vw — 16:9
const ADVANCE_MS = 2600;             // ms between steps

function Carousel3D({ images, active }: { images: string[]; active: boolean }) {
  const N = images.length;

  // Queue of 7 items — index 3 is center. Advancing pops front, pushes new to back.
  const [queue, setQueue] = useState<Item[]>(() =>
    Array.from({ length: 7 }, (_, i) => ({ id: i, src: images[i % N] }))
  );
  const nextId  = useRef(7);
  const nextImg = useRef(7 % N);

  useEffect(() => {
    if (!active || N === 0) return;
    const timer = setInterval(() => {
      setQueue(prev => [
        ...prev.slice(1),
        { id: nextId.current++, src: images[nextImg.current] },
      ]);
      nextImg.current = (nextImg.current + 1) % N;
    }, ADVANCE_MS);
    return () => clearInterval(timer);
  }, [active, images, N]);

  return (
    <div
      aria-hidden="true"
      style={{
        position:          'absolute',
        bottom:            '9%',
        left:              0,
        right:             0,
        height:            `${CARD_H * 1.4}vw`,
        perspective:       '1100px',
        perspectiveOrigin: '50% 50%',
        pointerEvents:     'none',
        opacity:           active ? 1 : 0,
        transition:        'opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {queue.map((item, qi) => {
        const s = SLOTS[qi];
        return (
          <img
            key={item.id}
            src={item.src}
            alt=""
            style={{
              position:     'absolute',
              top:          '50%',
              left:         '50%',
              width:        `${CARD_W}vw`,
              height:       `${CARD_H}vw`,
              marginTop:    `${-(CARD_H / 2)}vw`,
              marginLeft:   `${-(CARD_W / 2)}vw`,
              objectFit:    'cover',
              display:      'block',
              borderRadius: '3px',
              transform:    `translateX(${s.x}vw) scale(${s.scale}) rotateY(${s.ry}deg)`,
              opacity:      s.opacity,
              zIndex:       s.zIdx,
              transition:   'transform 0.88s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.88s cubic-bezier(0.22, 1, 0.36, 1)',
              willChange:   'transform, opacity',
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
      {/* Layer 1 — 3D coverflow carousel (design zone only) */}
      <Carousel3D images={thumbs} active={inDesign} />

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
