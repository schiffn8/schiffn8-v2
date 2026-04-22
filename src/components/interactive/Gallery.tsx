import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface GalleryImage {
  src: string;
  alt: string;
  caption?: string;
}

interface GalleryProps {
  images: GalleryImage[];
  columns?: 2 | 3 | 4;
}

export default function Gallery({ images, columns = 3 }: GalleryProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  const prev = () => setLightbox((i) => (i === null ? null : (i - 1 + images.length) % images.length));
  const next = () => setLightbox((i) => (i === null ? null : (i + 1) % images.length));

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 'var(--space-2)',
          margin: 'var(--space-12) 0',
        }}
      >
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setLightbox(i)}
            style={{ padding: 0, border: 0, background: 'none', cursor: 'zoom-in' }}
            aria-label={`View ${img.alt} fullscreen`}
          >
            <img
              src={img.src}
              alt={img.alt}
              loading="lazy"
              decoding="async"
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {lightbox !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLightbox(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(10,10,10,0.94)',
              zIndex: 200,
              display: 'grid',
              placeItems: 'center',
              cursor: 'zoom-out',
              padding: '2rem',
            }}
          >
            <motion.img
              key={lightbox}
              src={images[lightbox].src}
              alt={images[lightbox].alt}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />

            {/* Prev / Next */}
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Previous image"
              style={{
                position: 'fixed', left: '1.5rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
                fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem',
              }}
            >←</button>
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Next image"
              style={{
                position: 'fixed', right: '1.5rem', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
                fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem',
              }}
            >→</button>

            {/* Caption + counter */}
            <div style={{
              position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
              textAlign: 'center', color: 'rgba(255,255,255,0.5)',
              fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)',
              letterSpacing: 'var(--tracking-label)', textTransform: 'uppercase',
            }}>
              {images[lightbox].caption && (
                <p style={{ marginBottom: '0.25rem', color: 'rgba(255,255,255,0.7)' }}>
                  {images[lightbox].caption}
                </p>
              )}
              {lightbox + 1} / {images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
