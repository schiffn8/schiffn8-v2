import { useState, useCallback, useRef, useEffect } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone      = 'design' | 'ai' | 'astrion' | null;
type EdgeZone  = 'design' | 'astrion';
type AnimPhase = 'scrubbing' | 'animating' | 'reversing';

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

// Zone videos only on the edges — center uses the scrub directly
const ZONE_VIDEOS: Record<EdgeZone, string> = {
  design:  '/videos/zone-design.mp4',
  astrion: '/videos/zone-astrion.mp4',
};

// Trigger: past the scrub endpoints (25% left, 75% right)
const getAnimZone = (nx: number): EdgeZone | null =>
  nx < 0.25 ? 'design' : nx > 0.75 ? 'astrion' : null;

// ─── Cursor bubble ────────────────────────────────────────────────────────────

// Lerp-following circle that expands from a dot to a labeled ring when the
// cursor enters a named zone. Inspired by lauramonin.com.

const ZONE_LABELS: Record<NonNullable<Zone>, string> = {
  design: 'Design', ai: 'AI', astrion: 'Astrion',
};

function CursorBubble({ zone }: { zone: Zone }) {
  const outerRef  = useRef<HTMLDivElement>(null);
  const posRef    = useRef({ x: -200, y: -200 });
  const targetRef = useRef({ x: -200, y: -200 });
  const rafRef    = useRef<number>();

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const tick = () => {
      posRef.current.x += (targetRef.current.x - posRef.current.x) * 0.1;
      posRef.current.y += (targetRef.current.y - posRef.current.y) * 0.1;
      if (outerRef.current) {
        outerRef.current.style.transform =
          `translate(${posRef.current.x}px, ${posRef.current.y}px) translate(-50%, -50%)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current!);
    };
  }, []);

  const label    = zone ? ZONE_LABELS[zone] : '';
  const expanded = Boolean(label);

  return (
    <div
      ref={outerRef}
      aria-hidden="true"
      style={{
        position:      'fixed',
        top:           0,
        left:          0,
        width:         96,
        height:        96,
        pointerEvents: 'none',
        zIndex:        9999,
        willChange:    'transform',
      }}
    >
      {/* Ring — scales from dot to full circle */}
      <div style={{
        position:       'absolute',
        inset:          0,
        borderRadius:   '50%',
        border:         '1px solid rgba(255,255,255,0.65)',
        transform:      expanded ? 'scale(1)' : 'scale(0.1)',
        transition:     'transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
      }} />
      {/* Difference-blend dot — always centered, 1/6 of ring size */}
      <div style={{
        position:       'absolute',
        top:            '50%',
        left:           '50%',
        width:          16,
        height:         16,
        marginTop:      -8,
        marginLeft:     -8,
        borderRadius:   '50%',
        background:     '#fff',
        mixBlendMode:   'difference',
        pointerEvents:  'none',
      }} />
      {/* Label */}
      <div style={{
        position:       'absolute',
        inset:          0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        opacity:        expanded ? 1 : 0,
        transition:     'opacity 0.3s ease',
      }}>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      '0.58rem',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          color:         'rgba(255,255,255,0.9)',
          userSelect:    'none',
          whiteSpace:    'nowrap',
        }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── Zone animation videos (design + astrion only) ────────────────────────────

interface ZoneVideoProps {
  activeZone: EdgeZone | null;
  reversing:  boolean;
  onReversed: () => void;
}

function ZoneVideo({ activeZone, reversing, onReversed }: ZoneVideoProps) {
  const refs = useRef<Partial<Record<EdgeZone, HTMLVideoElement>>>({});

  // Forward playback
  useEffect(() => {
    (Object.keys(ZONE_VIDEOS) as EdgeZone[]).forEach((z) => {
      const vid = refs.current[z];
      if (!vid) return;
      if (z === activeZone && !reversing) {
        vid.loop         = true;
        vid.playbackRate = 1;
        vid.currentTime  = 0;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });
  }, [activeZone, reversing]);

  // rAF reverse scrub — rewinds to frame 0 at 4× speed, then hands back
  useEffect(() => {
    if (!reversing || !activeZone) return;
    const vid = refs.current[activeZone];
    if (!vid) return;

    vid.pause();
    let rafId: number;
    let last: number | null = null;

    const step = (now: number) => {
      const dt   = last !== null ? Math.min((now - last) / 1000, 0.05) : 0;
      last       = now;
      const next = vid.currentTime - dt * 4;
      if (next <= 0) {
        vid.currentTime = 0;
        onReversed();
        return;
      }
      vid.currentTime = next;
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [reversing, activeZone, onReversed]);

  return (
    <>
      {(Object.keys(ZONE_VIDEOS) as EdgeZone[]).map((z) => (
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
            opacity:       activeZone === z ? 1 : 0,
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
  const [zone,       setZone]       = useState<Zone>(null);
  const [animZone,   setAnimZone]   = useState<EdgeZone | null>(null);
  const [activeZone, setActiveZone] = useState<EdgeZone | null>(null);
  const [phase,      setPhase]      = useState<AnimPhase>('scrubbing');
  const [labels,     setLabels]     = useState({ design: 0, ai: 0, astrion: 0 });
  const cursorXRef  = useRef<number>(0.5);
  const lastMoveRef = useRef<number>(Date.now());

  // Settle timer — fires immediately (0ms) when cursor enters an edge zone
  // and has been still since entering
  useEffect(() => {
    if (phase !== 'scrubbing' || !animZone) return;
    let tid: ReturnType<typeof setTimeout>;
    const check = () => {
      const idle = Date.now() - lastMoveRef.current;
      if (idle >= 0) {
        setActiveZone(animZone);
        setPhase('animating');
      } else {
        tid = setTimeout(check, -idle);
      }
    };
    tid = setTimeout(check, 0);
    return () => clearTimeout(tid);
  }, [animZone, phase]);

  const handleReversed = useCallback(() => {
    setPhase('scrubbing');
    setActiveZone(null);
  }, []);

  const getZone = (nx: number): Zone =>
    nx < 0.33 ? 'design' : nx > 0.66 ? 'astrion' : 'ai';

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    cursorXRef.current  = nx;
    lastMoveRef.current = Date.now();
    const z  = getZone(nx);
    const az = getAnimZone(nx);
    setZone(z);
    setAnimZone(az);
    setLabels({ design: 0, ai: 0, astrion: 0, [z]: 1 });
    // Reverse only when cursor moves back into the scrub area (25–75%)
    setPhase(prev => {
      if (prev !== 'animating') return prev;
      if (activeZone === 'design'  && nx <  0.25) return prev;
      if (activeZone === 'astrion' && nx >  0.75) return prev;
      return 'reversing';
    });
  }, [activeZone]);

  const handleMouseLeave = useCallback(() => {
    cursorXRef.current  = 0.5;
    lastMoveRef.current = Date.now();
    setZone(null);
    setAnimZone(null);
    setLabels({ design: 0, ai: 0, astrion: 0 });
    setPhase(prev => prev === 'animating' ? 'reversing' : prev);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
    cursorXRef.current  = nx;
    lastMoveRef.current = Date.now();
    const z  = getZone(nx);
    const az = getAnimZone(nx);
    setZone(z);
    setAnimZone(az);
    setLabels({ design: 0, ai: 0, astrion: 0, [z]: 1 });
    setPhase(prev => {
      if (prev !== 'animating') return prev;
      if (activeZone === 'design'  && nx <  0.25) return prev;
      if (activeZone === 'astrion' && nx >  0.75) return prev;
      return 'reversing';
    });
  }, [activeZone]);

  const handleClick    = useCallback(() => { if (zone) window.location.href = ROUTES[zone]; }, [zone]);
  const handleTouchEnd = useCallback(() => { if (zone) window.location.href = ROUTES[zone]; }, [zone]);

  const showingAnimation = phase === 'animating' || phase === 'reversing';

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
      {/* Layer 1a — mouse-scrubbed brain (fades out while edge zone plays) */}
      <div
        style={{
          position:      'absolute',
          inset:         0,
          mixBlendMode:  'screen',
          pointerEvents: 'none',
          zIndex:        1,
          opacity:       showingAnimation ? 0 : 1,
          transition:    'opacity 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <MouseScrub src={VIDEO_SRC} poster={POSTER_SRC} cursorXRef={cursorXRef} />
      </div>

      {/* Layer 1b — design / astrion zone videos */}
      <ZoneVideo
        activeZone={activeZone}
        reversing={phase === 'reversing'}
        onReversed={handleReversed}
      />

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

      <CursorBubble zone={zone} />
    </div>
  );
}
