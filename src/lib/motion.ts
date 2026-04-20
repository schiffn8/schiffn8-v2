// MISSION CONTROL MOTION PRINCIPLES
// 1. Fast in, slow out. Entrances use ease-out (0.22, 1, 0.36, 1), not ease-in-out.
// 2. Nothing bounces. Stay with ease-out — restraint reads as confidence.
// 3. Stagger 40-60ms for groups. Longer feels laggy; shorter feels like no stagger.
// 4. Scroll reveals fire ONCE, not on every pass. use `once: true` in useInView.
// 5. Respect prefers-reduced-motion. Every variant must honor it.
// 6. Transform and opacity only. Never animate layout properties (width, height, padding).
// 7. Two to four motion moments across the ENTIRE site. Punctuation, not decoration.
// 8. Base duration: 400ms. Hero moments: 800ms. Never over 1200ms.

const ease = [0.22, 1, 0.36, 1] as const;  // easeOutQuint — the MC easing

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease },
  },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

export const staggerChildren = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

// Hero entrance — slower, more cinematic
export const heroReveal = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease },
  },
};

// Mask reveal for hero images — the signature MC move
// Wipes left-to-right, revealing the image like a shutter opening
export const maskReveal = {
  hidden: { clipPath: 'inset(0 100% 0 0)' },
  visible: {
    clipPath: 'inset(0 0% 0 0)',
    transition: { duration: 1.0, ease: [0.76, 0, 0.24, 1] },  // custom easeInOutExpo
  },
};

// Subtle scale on image hover — NOT a tilt, NOT over 1.05
export const imageHover = {
  rest: { scale: 1 },
  hover: { scale: 1.03, transition: { duration: 0.5, ease } },
};
