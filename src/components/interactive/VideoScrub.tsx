import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface VideoScrubProps {
  src: string;
  poster?: string;
  // How many viewport heights to spend scrubbing through the full video.
  // 300 = 3x viewport height of scroll = comfortable Apple-style pace.
  scrollHeightVh?: number;
}

export default function VideoScrub({
  src,
  poster,
  scrollHeightVh = 300,
}: VideoScrubProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    // Respect prefers-reduced-motion — show static poster, no scrub
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    gsap.registerPlugin(ScrollTrigger);

    let trigger: ScrollTrigger | null = null;

    const setup = () => {
      if (!video.duration) return;

      trigger = ScrollTrigger.create({
        trigger: container,
        start: 'top top',
        end: 'bottom bottom',
        pin: video,
        pinSpacing: false,
        scrub: true,
        onUpdate: (self) => {
          // Direct assignment — no smoothing lag on video scrub
          video.currentTime = self.progress * video.duration;
        },
      });
    };

    if (video.readyState >= 1) {
      setup();
    } else {
      video.addEventListener('loadedmetadata', setup, { once: true });
    }

    return () => {
      trigger?.kill();
    };
  }, []);

  return (
    // Tall container — the scroll distance that drives the scrub
    <div
      ref={containerRef}
      style={{ height: `${scrollHeightVh}vh`, position: 'relative' }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="auto"
        // Prevent any browser-default play behavior
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: '100%',
          height: '100vh',
          objectFit: 'cover',
          display: 'block',
          // Will be pinned by GSAP — needs position context
          position: 'sticky',
          top: 0,
        }}
      />
    </div>
  );
}
