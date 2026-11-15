import { useId } from 'react';

import { cn } from '../lib/utils';

/**
 * The drawings an illustrated `EmptyState` can carry, one family: a 120×96
 * frame, a soft glow of the card's tone behind the subject and a shadow under
 * it, ink in `currentColor` (subtle) at 1.35, fills from the surface tokens,
 * so each reads in both themes. Decoration only: hidden from assistive
 * technology, the title beside it says what it means.
 */
const EMPTY_ART = {
  automations: AutomationsArt,
  done: DoneArt,
  inbox: InboxArt,
  milestones: MilestonesArt,
  notFound: NotFoundArt,
  projects: ProjectsArt,
  pullRequests: PullRequestsArt,
  tasks: TasksArt,
} as const;

type EmptyArtName = keyof typeof EMPTY_ART;

const ink = {
  stroke: 'currentColor',
  strokeWidth: 1.35,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
} as const;

function EmptyArt({ name, className }: { name: EmptyArtName; className?: string }) {
  const glow = `empty-art-glow-${useId().replace(/[^\w-]/g, '')}`;
  const Subject = EMPTY_ART[name];
  return (
    <svg
      viewBox="0 0 120 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
      data-art={name}
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
      <Subject />
    </svg>
  );
}

function Sparkles() {
  return (
    <g fill="currentColor">
      <path d="M60 11 Q61 18.5 66 20 Q61 21.5 60 29 Q59 21.5 54 20 Q59 18.5 60 11 Z" opacity="0.7" />
      <path d="M80 22 Q80.6 26 83.5 27 Q80.6 28 80 32 Q79.4 28 76.5 27 Q79.4 26 80 22 Z" opacity="0.5" />
      <path d="M41 25 Q41.4 27.6 43.5 28.5 Q41.4 29.4 41 32 Q40.6 29.4 38.5 28.5 Q40.6 27.6 41 25 Z" opacity="0.45" />
      <circle cx="47" cy="15" r="1.2" opacity="0.4" />
      <circle cx="72" cy="12.5" r="1" opacity="0.35" />
      <circle cx="90" cy="36" r="0.9" opacity="0.3" />
    </g>
  );
}

/** An empty tray, open a little toward the reader, sparkles over it. */
function InboxArt() {
  return (
    <>
      <path
        d="M33 42.5 Q33.6 40 36 40 H84 Q86.4 40 87 42.5 L94 54 H26 Z"
        className="fill-canvas-recessed"
        {...ink}
      />
      <path d="M36 44.5 H84 L89 52 H31 Z" fill="currentColor" opacity="0.07" />
      <path
        d="M24 55 Q24 54 25 54 H44 Q46 54 47 56 L48.5 59 Q49.5 61 51.5 61 H68.5 Q70.5 61 71.5 59 L73 56 Q74 54 76 54 H95 Q96 54 96 55 L94.5 73 Q94 77 90 77 H30 Q26 77 25.5 73 Z"
        className="fill-card"
        {...ink}
      />
      <Sparkles />
    </>
  );
}

/** Two folders, one behind the other: the place sessions will be grouped. */
function ProjectsArt() {
  return (
    <>
      <path
        d="M36 30 Q36 28 38 28 H52 Q53.5 28 54.5 29.2 L57.5 33 H84 Q86 33 86 35 V62 H36 Z"
        className="fill-canvas-recessed"
        {...ink}
      />
      <path
        d="M26 42 Q26 40 28 40 H45 Q46.5 40 47.5 41.2 L50.5 45 H92 Q94 45 94 47 V74 Q94 77 91 77 H29 Q26 77 26 74 Z"
        className="fill-card"
        {...ink}
      />
      <path d="M26 52 H94" stroke="currentColor" strokeWidth="1.35" opacity="0.35" />
      <path d="M36 62 H60" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.3" />
    </>
  );
}

/** A card with a branch merging back into its base, a second card behind it. */
function PullRequestsArt() {
  return (
    <>
      <rect x="38" y="20" width="58" height="46" rx="6" className="fill-canvas-recessed" {...ink} />
      <rect x="26" y="30" width="62" height="47" rx="6" className="fill-card" {...ink} />
      <path d="M43 46 V61" {...ink} />
      <path d="M72 61 V54 Q72 46 64 46 H54" {...ink} />
      <path d="M58 42 L54 46 L58 50" {...ink} />
      <circle cx="43" cy="42" r="4" className="fill-card" {...ink} />
      <circle cx="43" cy="65" r="4" className="fill-card" {...ink} />
      <circle cx="72" cy="65" r="4" fill="currentColor" opacity="0.7" />
    </>
  );
}

/** A check in a disc, sparkles over it: there was a list, and it is through. */
function DoneArt() {
  return (
    <>
      <circle cx="60" cy="53" r="22" className="fill-card" {...ink} />
      <circle cx="60" cy="53" r="16" fill="currentColor" opacity="0.07" />
      <path d="M51 53.5 L57.5 60 L70 47" {...ink} strokeWidth="2.2" />
      <Sparkles />
    </>
  );
}

/** A clock with a bolt beside it: on a schedule, or when something happens. */
function AutomationsArt() {
  return (
    <>
      <circle cx="56" cy="54" r="23" className="fill-card" {...ink} />
      <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.45">
        <path d="M56 35 V38" />
        <path d="M75 54 H72" />
        <path d="M56 73 V70" />
        <path d="M37 54 H40" />
      </g>
      <path d="M56 42 V54 L64 59" {...ink} strokeWidth="1.8" />
      <circle cx="56" cy="54" r="1.6" fill="currentColor" />
      <circle cx="81" cy="33" r="11" className="fill-canvas-recessed" {...ink} />
      <path d="M82.5 25.5 L76.5 34.5 H81 L79.5 40.5 L86 31 H81.5 Z" fill="currentColor" opacity="0.75" />
    </>
  );
}

/** A path with milestone diamonds along it, toward a flag. */
function MilestonesArt() {
  return (
    <>
      <path
        d="M20 72 Q40 62 56 66 Q72 70 84 56"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeDasharray="0.5 4.5"
        opacity="0.6"
      />
      <path d="M36 61.5 L40.5 66 L36 70.5 L31.5 66 Z" className="fill-card" {...ink} />
      <path d="M58 61.5 L62.5 66 L58 70.5 L53.5 66 Z" fill="currentColor" opacity="0.7" />
      <path d="M85 56 V22" {...ink} />
      <path d="M85 23 H104 L99 30 L104 37 H85 Z" className="fill-card" {...ink} />
      <ellipse cx="85" cy="56.5" rx="5" ry="1.4" fill="currentColor" opacity="0.15" />
    </>
  );
}

/** A short list, two items ticked and one still open. */
function TasksArt() {
  return (
    <>
      <rect x="34" y="18" width="52" height="59" rx="6" className="fill-card" {...ink} />
      {[32, 46, 60].map((y, index) => (
        <g key={y}>
          <rect
            x="42"
            y={y - 4.5}
            width="9"
            height="9"
            rx="2.5"
            className={index < 2 ? undefined : 'fill-canvas-recessed'}
            fill={index < 2 ? 'currentColor' : undefined}
            fillOpacity={index < 2 ? 0.14 : undefined}
            {...ink}
          />
          {index < 2 ? <path d={`M44.3 ${y} L46.2 ${y + 2} L49 ${y - 1.8}`} {...ink} /> : null}
          <path
            d={`M57 ${y} H${index === 1 ? 70 : 77}`}
            stroke="currentColor"
            strokeWidth="1.35"
            strokeLinecap="round"
            opacity={index < 2 ? 0.35 : 0.6}
          />
        </g>
      ))}
    </>
  );
}

/** A compass with its needle up: the way back, not the page. */
function NotFoundArt() {
  return (
    <>
      <circle cx="60" cy="52" r="25" className="fill-card" {...ink} />
      <circle cx="60" cy="52" r="19" stroke="currentColor" strokeWidth="1.35" opacity="0.25" />
      <g stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" opacity="0.45">
        <path d="M60 30 V33" />
        <path d="M82 52 H79" />
        <path d="M60 74 V71" />
        <path d="M38 52 H41" />
      </g>
      <path d="M60 36 L65 52 H55 Z" fill="currentColor" opacity="0.7" />
      <path d="M55 52 H65 L60 68 Z" className="fill-canvas-recessed" {...ink} />
      <path d="M60 36 L65 52 L60 68 L55 52 Z" {...ink} />
      <circle cx="60" cy="52" r="1.8" className="fill-card" {...ink} />
    </>
  );
}

export { EmptyArt };
export type { EmptyArtName };
