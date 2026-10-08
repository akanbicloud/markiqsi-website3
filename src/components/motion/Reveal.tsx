'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { CSSProperties, ReactNode } from 'react';

const ease = [0.16, 1, 0.3, 1] as const;

/** Fades and slides content up the first time it scrolls into view. Does nothing for people who turn motion off. */
export function Reveal({ children, delay = 0, y = 28, className, style }: { children: ReactNode; delay?: number; y?: number; className?: string; style?: CSSProperties }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={still ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.9, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

/** A grid or list whose children appear one after another. Use RevealItem for each child. */
export function RevealGroup({ children, className, style, stagger = 0.12 }: { children: ReactNode; className?: string; style?: CSSProperties; stagger?: number }) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={still ? false : 'hidden'}
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={{ hidden: { opacity: 0, y: 36 }, show: { opacity: 1, y: 0, transition: { duration: 0.9, ease } } }}
      whileHover={{ y: -8, transition: { duration: 0.4, ease } }}
    >
      {children}
    </motion.div>
  );
}

/** A page section that fades and slides up when it scrolls into view. */
export function RevealSection({ children, className, style, id, 'aria-labelledby': labelledBy }: { children: ReactNode; className?: string; style?: CSSProperties; id?: string; 'aria-labelledby'?: string }) {
  const still = useReducedMotion();
  return (
    <motion.section
      id={id}
      aria-labelledby={labelledBy}
      className={className}
      style={style}
      initial={still ? false : { opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.9, ease }}
    >
      {children}
    </motion.section>
  );
}
