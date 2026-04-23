import { useState, useCallback, useRef, useEffect } from 'react';
import MouseScrub from './MouseScrub';

// ─── Types & config ───────────────────────────────────────────────────────────

type Zone      = 'design' | 'ai' | 'astrion' | null;
type AnimPhase = 'scrubbing' | 'animating' | 'reversing';

const ROUTES = { design: '/work', ai: '/ai', astrion: '/astrion' } as const;
const COLORS = { design: '#ff6030', ai: '#00e5ff', astrion: '#4488ff' } as const;

const VIDEO_SRC  = '/videos/brain-transition.mp4';
const POSTER_SRC = '/images/brain-ai.webp';

const ZONE_VIDEOS: Record<NonNullable<Zone>, string> = {
  design:  '/videos/zone-design.mp4',
  ai:      '/videos/zone-ai.mp4',
  astrion: '/videos/zone-astrion.mp4',
};

const REWIND_RATE = 4; // × realtime

// Each zone has its own trigger region and settle time.
// Design/astrion fire when the cursor pushes past the scrub endpoints (25%/75%).
// AI only fires when perfectly centered (middle 5%) for longer.
const ANIM_ZONES: { zone: NonNullable<Zone>; min: number; max: number; settle: number }[] = [
  { zone: 'design',  min: 0,     max: 0.25,  settle: 0 },
  { zone: 'ai',      min: 0.475, max: 0.525, settle: 0 },
  { zone: 'astrion', min: 0.75,  max: 1,     settle: 0 },
];

const getAnimZone = (nx: number): Zone => {
  const match = ANIM_ZONES.find(z => nx >= z.min && nx <= z.max);
  return match ? match.zone : null;
};

const getAnimSettle = (z: NonNullable<Zone>) =>
  ANIM_ZONES.find(a => a.zone === z)!.settle;

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

// All three videos stay in the DOM so they're buffered.
//
// animating  — plays forward, looped, at 1×
// reversing  — rAF loop scrubs currentTime backward at REWIND_RATE×;
//              when it reaches 0 the brain scrub takes over seamlessly
//              (frame 0 of each zone video should match the brain's resting
//              state so the crossfade is invisible)

interface ZoneVideoProps {
  activeZone: Zone;
  reversing:  boolean;
  onReversed: () => void;
}

function ZoneVideo({ activeZone, reversing, onReversed }: ZoneVideoProps) {
  const refs = useRef<Partial<Record<NonNullable<Zone>, HTMLVideoElement>>>({});

  // Start / stop forward playback
  useEffect(() => {
    const zones = Object.keys(ZONE_VIDEOS) as NonNullable<Zone>[];
    zones.forEach((z) => {
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

  // rAF-based reverse scrub — runs only in reversing phase
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
      const next = vid.currentTime - dt * REWIND_RATE;

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
  const [zone,       setZone]       = useState<Zone>(null);      // label/nav zone (33%/66%)
  const [animZone,   setAnimZone]   = useState<Zone>(null);      // animation trigger zone
  const [activeZone, setActiveZone] = useState<Zone>(null);
  const [phase,      setPhase]      = useState<AnimPhase>('scrubbing');
  const [labels,     setLabels]     = useState({ design: 0, ai: 0, astrion: 0 });
  const cursorXRef  = useRef<number>(0.5);
  const lastMoveRef = useRef<number>(Date.now());

  // Self-rescheduling settle timer: checks lastMoveRef on fire so the cursor
  // must be truly still for the full settle duration — not just in the zone.
  useEffect(() => {
    if (phase !== 'scrubbing' || !animZone) return;
    const settle = getAnimSettle(animZone);
    let tid: ReturnType<typeof setTimeout>;

    const check = () => {
      const idle = Date.now() - lastMoveRef.current;
      if (idle >= settle) {
        setActiveZone(animZone);
        setPhase('animating');
      } else {
        tid = setTimeout(check, settle - idle);
      }
    };

    tid = setTimeout(check, settle);
    return () => clearTimeout(tid);
  }, [animZone, phase]);

  // Called by ZoneVideo once the reverse scrub reaches frame 0
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
    // Design/astrion: only reverse when cursor re-enters the scrub area (25–75%).
    // Movement anywhere within their own trigger zones lets the video play freely.
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
      {/* Layer 1a — scrubbed brain (hidden while zone animation plays or rewinds) */}
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

      {/* Layer 1b — zone animation videos */}
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

      <CursorBubble />
    </div>
  );
}
