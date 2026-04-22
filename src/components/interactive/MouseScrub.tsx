import { useEffect, useRef } from 'react';

interface Props {
  src: string;
  poster?: string;
  /** Called with normalized cursor X (0..1) on every mousemove */
  onMouseX?: (nx: number) => void;
  onMouseLeave?: () => void;
}

/**
 * Full-viewport video scrubbed by horizontal cursor position.
 * 0 = leftmost frame (design brain), 0.5 = center (AI brain), 1.0 = rightmost (Astrion).
 * Uses a lerped rAF loop to smooth seeking and avoid per-pixel seek thrash.
 */
export default function MouseScrub({ src, poster, onMouseX, onMouseLeave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const targetX      = useRef(0.5);  // where the cursor wants to be
  const currentX     = useRef(0.5);  // smoothed position driving currentTime
  const rafId        = useRef<number>();
  const isReady      = useRef(false);

  useEffect(() => {
    const video     = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return; // static poster for reduced-motion users

    // rAF loop: lerp currentX toward targetX, then set video.currentTime
    const tick = () => {
      if (isReady.current && video.duration) {
        currentX.current += (targetX.current - currentX.current) * 0.09;
        const t = Math.max(0, Math.min(1, currentX.current));
        video.currentTime = t * video.duration;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    // Start at center (AI brain) once metadata is available
    const onReady = () => {
      isReady.current = true;
      currentX.current = 0.5;
      targetX.current  = 0.5;
      video.currentTime = video.duration * 0.5;
    };
    video.addEventListener('loadedmetadata', onReady);

    const handleMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      targetX.current = nx;
      onMouseX?.(nx);
    };

    const handleLeave = () => {
      targetX.current = 0.5; // ease back to AI brain (center)
      onMouseLeave?.();
    };

    container.addEventListener('mousemove', handleMove);
    container.addEventListener('mouseleave', handleLeave);

    // Touch
    const handleTouch = (e: TouchEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
      targetX.current = nx;
      onMouseX?.(nx);
    };
    container.addEventListener('touchmove', handleTouch, { passive: true });

    return () => {
      cancelAnimationFrame(rafId.current!);
      video.removeEventListener('loadedmetadata', onReady);
      container.removeEventListener('mousemove', handleMove);
      container.removeEventListener('mouseleave', handleLeave);
      container.removeEventListener('touchmove', handleTouch);
    };
  }, [onMouseX, onMouseLeave]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="auto"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
