'use client';

export function BackToTop() {
  return (
    <button
      type="button"
      className="to-top"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
    >
      Top
    </button>
  );
}
