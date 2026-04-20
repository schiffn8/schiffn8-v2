import { motion, useInView } from 'motion/react';
import { useRef } from 'react';
import { fadeUp } from '../../lib/motion';

interface ScrollRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export default function ScrollReveal({ children, delay = 0, className }: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ delay: delay / 1000 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
