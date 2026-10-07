import { useId } from 'react';

export function LogoMark({ size = 44 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={Math.round(size * 0.9)} viewBox="-4 -4 318 286" aria-hidden="true">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A9DFF" />
          <stop offset="1" stopColor="#1A5FD0" />
        </linearGradient>
        <mask id={`m${id}`}>
          <rect x="-10" y="-10" width="340" height="300" fill="#fff" />
          <rect x="151" y="-10" width="8" height="118" fill="#000" />
        </mask>
      </defs>
      <path
        fill={`url(#g${id})`}
        fillRule="evenodd"
        mask={`url(#m${id})`}
        d="M0,70 L22,70 Q70,8 155,2 Q240,8 288,70 L310,70 L310,242 Q240,248 155,278 Q70,248 0,242 Z M15,130 Q155,84 295,130 Q195,150 155,272 Q115,150 15,130 Z"
      />
    </svg>
  );
}
