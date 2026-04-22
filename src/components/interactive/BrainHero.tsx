import { useState, useCallback, useRef, useEffect } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone = 'design' | 'ai' | 'astrion' | null;

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

// ─── Cursor bubble trail ──────────────────────────────────────────────────────

// Each ghost samples the cursor's position history at 33/66/100ms lookback.
// Opacity = 1 - (age / 100ms), so ghosts fully vanish 100ms after the cursor stops.
const GHOST_SIZES = [42, 28, 16] as const; // px — 3 trailing ghosts
const TRAIL_MS    = 100;
const LEAD_SIZE   = 58;

function CursorBubbles() {
  const leadRef   = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<Array<HTMLDivElement | null>>(new Array(3).fill(null));
  // Timestamped position ring-buffer; newest entries at the back
  const history   = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const curPos    = useRef({ x: -200, y: -200 });
  const rafRef    = useRef<number>();

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      curPos.current = { x: e.clientX, y: e.clientY };
      history.current.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    };
    const onLeave = () => {
      curPos.current = { x: -200, y: -200 };
      history.current = [];
    };

    const tick = () => {
      const now = performance.now();

      // Prune entries older than the trail window
      while (history.current.length > 0 && now - history.current[0].t > TRAIL_MS) {
        history.current.shift();
      }

      // Lead — always snaps to current cursor, no transition
      if (leadRef.current) {
        leadRef.current.style.transform =
          `translate(${curPos.current.x - LEAD_SIZE / 2}px, ${curPos.current.y - LEAD_SIZE / 2}px)`;
      }

      // Ghosts — find the history point closest to each lookback target
      ghostRefs.current.forEach((el, i) => {
        if (!el) return;
        const h = history.current;
        if (h.length === 0) { el.style.opacity = '0'; return; }

        const targetTime = now - ((i + 1) / 3) * TRAIL_MS; // 33, 66, 100ms ago
        let best = h[0];
        let bestDiff = Math.abs(h[0].t - targetTime);
        for (const p of h) {
          const d = Math.abs(p.t - targetTime);
          if (d < bestDiff) { bestDiff = d; best = p; }
        }

        const age = now - best.t;
        const opacity = Math.max(0, 1 - age / TRAIL_MS);
        const size = GHOST_SIZES[i];
        el.style.opacity = String(opacity);
        el.style.transform = `translate(${best.x - size / 2}px, ${best.y - size / 2}px)`;
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(rafRef.current!);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <>
      <div
        ref={leadRef}
        aria-hidden="true"
        style={{
          position: 'fixed', top: 0, left: 0,
          width: LEAD_SIZE, height: LEAD_SIZE,
          borderRadius: '50%', background: '#fff',
          mixBlendMode: 'difference', pointerEvents: 'none',
          transform: 'translate(-200px, -200px)',
          zIndex: 9999, willChange: 'transform',
        }}
      />
      {GHOST_SIZES.map((size, i) => (
        <div
          key={i}
          ref={el => { ghostRefs.current[i] = el; }}
          aria-hidden="true"
          style={{
            position: 'fixed', top: 0, left: 0,
            width: size, height: size,
            borderRadius: '50%', background: '#fff',
            mixBlendMode: 'difference', pointerEvents: 'none',
            opacity: 0,
            transform: 'translate(-200px, -200px)',
            zIndex: 9998 - i, willChange: 'transform, opacity',
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
        position:              'absolute',
        top:                   0,
        left:                  0,
        width:                 '33.33vw',
        height:                '100dvh',
        display:               'grid',
        gridTemplateColumns:   '1fr 1fr',
        gridTemplateRows:      '1fr 1fr 1fr',
        zIndex:                3,
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
  const [zone,   setZone]   = useState<Zone>(null);
  const [labels, setLabels] = useState({ design: 0, ai: 0, astrion: 0 });
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
      {/* Layer 1 — brain video (screen blend on black; pointer-events:none so grid gets hover) */}
      <div
        style={{
          position: 'absolute', inset: 0,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <MouseScrub src={VIDEO_SRC} poster={POSTER_SRC} cursorXRef={cursorXRef} />
      </div>

      {/* Layer 2 — 2×3 project image grid (left third, above brain) */}
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

      {/* Cursor bubble trail — lead + 3 shrinking ghosts, all invert via difference blend */}
      <CursorBubbles />
    </div>
  );
}
