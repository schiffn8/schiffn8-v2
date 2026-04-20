import { motion } from 'motion/react';
import { fadeUp, staggerChildren } from '../../lib/motion';

interface HeroProps {
  kicker?: string;
  headline: string;
  subline?: string;
}

export default function Hero({ kicker = 'Nate Schiffler — Design', headline, subline }: HeroProps) {
  return (
    <section
      style={{
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        padding: '1.5rem 2rem',
      }}
    >
      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-muted)',
        }}
      >
        {kicker}
      </motion.p>

      <motion.div
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <motion.h1
          variants={fadeUp}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3.5rem, 9vw, 9rem)',
            fontWeight: 400,
            lineHeight: 1.0,
            letterSpacing: '-0.03em',
            maxWidth: '16ch',
            margin: 0,
          }}
        >
          {headline}
        </motion.h1>
      </motion.div>

      <motion.div
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: '2rem',
        }}
      >
        {subline && (
          <motion.p
            variants={fadeUp}
            style={{
              maxWidth: '42ch',
              lineHeight: 1.6,
              color: 'var(--color-muted)',
              margin: 0,
            }}
          >
            {subline}
          </motion.p>
        )}
        <motion.p
          variants={fadeUp}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            whiteSpace: 'nowrap',
            margin: 0,
          }}
        >
          01 Work · 02 About · 03 Contact
        </motion.p>
      </motion.div>
    </section>
  );
}
