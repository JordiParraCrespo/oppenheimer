import { useId } from 'react';

import { cn } from '../lib/utils';

/**
 * The empty tray over the clear pane: an open box seen a little from the
 * front, a few sparkles over it, on a soft glow of the card's tone. Ink is
 * `currentColor` (subtle) and fills are tokens, so it reads in both themes;
 * it is decoration only.
 */
export function InboxClearArt({ className }: { className?: string }) {
  const glow = `inbox-clear-glow-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      viewBox="0 0 120 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={cn('h-28 w-35 text-fg-subtle', className)}
    >
      <defs>
        <radialGradient id={glow} className="text-card">
          <stop offset="0" stopColor="currentColor" stopOpacity="1" />
          <stop offset="0.55" stopColor="currentColor" stopOpacity="0.6" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="50" rx="58" ry="44" fill={`url(#${glow})`} />
      <ellipse cx="60" cy="80" rx="34" ry="3" fill="currentColor" opacity="0.12" />
      {/* The opening: the back rim, and the tray's floor in shade. */}
      <path
        d="M33 42.5 Q33.6 40 36 40 H84 Q86.4 40 87 42.5 L94 54 H26 Z"
        className="fill-canvas-recessed"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M36 44.5 H84 L89 52 H31 Z" fill="currentColor" opacity="0.07" />
      {/* The front face, with the dip an inbox tray has. */}
      <path
        d="M24 55 Q24 54 25 54 H44 Q46 54 47 56 L48.5 59 Q49.5 61 51.5 61 H68.5 Q70.5 61 71.5 59 L73 56 Q74 54 76 54 H95 Q96 54 96 55 L94.5 73 Q94 77 90 77 H30 Q26 77 25.5 73 Z"
        className="fill-card"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <g fill="currentColor">
        <path d="M60 11 Q61 18.5 66 20 Q61 21.5 60 29 Q59 21.5 54 20 Q59 18.5 60 11 Z" opacity="0.7" />
        <path d="M80 22 Q80.6 26 83.5 27 Q80.6 28 80 32 Q79.4 28 76.5 27 Q79.4 26 80 22 Z" opacity="0.5" />
        <path d="M41 25 Q41.4 27.6 43.5 28.5 Q41.4 29.4 41 32 Q40.6 29.4 38.5 28.5 Q40.6 27.6 41 25 Z" opacity="0.45" />
        <circle cx="47" cy="15" r="1.2" opacity="0.4" />
        <circle cx="72" cy="12.5" r="1" opacity="0.35" />
        <circle cx="90" cy="36" r="0.9" opacity="0.3" />
      </g>
    </svg>
  );
}
