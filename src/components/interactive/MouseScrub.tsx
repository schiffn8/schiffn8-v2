import { useEffect, useRef } from 'react';

interface Props {
  src: string;
  poster?: string;
  /** Mutable ref updated externally on every mousemove / touchmove */
  cursorXRef: React.MutableRefObject<number>;
}

/**
 * Full-viewport video scrubbed by an externally-controlled cursor X ref.
 * The parent owns event tracking; this component just drives currentTime.
 */
export default function MouseScrub({ src, poster, cursorXRef }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const currentX = useRef(0.5);
  const rafId    = useRef<number>();
  const isReady  = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const tick = () => {
      if (isReady.current && video.duration) {
        currentX.current += (cursorXRef.current - currentX.current) * 0.09;
        // Map the center 50% of the viewport (0.25–0.75) to the full video
        const t = Math.max(0, Math.min(1, (currentX.current - 0.25) * 2));
        video.currentTime = t * video.duration;
      }
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    const onReady = () => {
      isReady.current = true;
      currentX.current = 0.5;
      video.currentTime = video.duration * 0.5;
    };
    video.addEventListener('loadedmetadata', onReady);

    return () => {
      cancelAnimationFrame(rafId.current!);
      video.removeEventListener('loadedmetadata', onReady);
    };
  }, [cursorXRef]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      muted
      playsInline
      preload="auto"
      style={{
        width: '100%', height: '100%',
        objectFit: 'cover', display: 'block',
        pointerEvents: 'none',
      }}
    />
  );
}
