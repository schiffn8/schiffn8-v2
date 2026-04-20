import { motion } from 'motion/react';
import { heroReveal, staggerChildren, fadeUp } from '../../lib/motion';

interface HeroProps {
  kicker?: string;
  headline: string;
  subline?: string;
}

export default function Hero({
  kicker = 'Nate Schiffler — Design',
  headline,
  subline,
}: HeroProps) {
  return (
    <section
      style={{
        height: '100dvh',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        padding: 'var(--space-8) var(--gutter)',
        maxWidth: 'var(--max-w-wide)',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Top — kicker */}
      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--text-xs)',
          letterSpacing: 'var(--tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--muted)',
          paddingTop: 'var(--space-4)',
        }}
      >
        {kicker}
      </motion.p>

      {/* Center — ONE massive headline */}
      <motion.div
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
        style={{ display: 'flex', alignItems: 'center' }}
      >
        <motion.h1
          variants={heroReveal}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-display)',
            fontWeight: 400,
            lineHeight: 'var(--leading-tight)',
            letterSpacing: 'var(--tracking-display)',
            maxWidth: '16ch',
            margin: 0,
          }}
        >
          {headline}
        </motion.h1>
      </motion.div>

      {/* Bottom — subline left, index right */}
      <motion.div
        variants={staggerChildren}
        initial="hidden"
        animate="visible"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 'var(--space-8)',
          paddingBottom: 'var(--space-4)',
        }}
      >
        {subline && (
          <motion.p
            variants={fadeUp}
            style={{
              maxWidth: '42ch',
              lineHeight: 'var(--leading-relaxed)',
              color: 'var(--muted)',
              margin: 0,
              fontSize: 'var(--text-base)',
            }}
          >
            {subline}
          </motion.p>
        )}
        <motion.p
          variants={fadeUp}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            letterSpacing: 'var(--tracking-mono)',
            textTransform: 'uppercase',
            color: 'var(--muted)',
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
