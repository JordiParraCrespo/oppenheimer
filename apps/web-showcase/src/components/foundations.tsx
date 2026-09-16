import { icons as LUCIDE } from 'lucide-react';
import { DURATIONS } from '@/lib/toc';
import { ThemePair } from '@/components/page-shell';

/* ── Colours ─────────────────────────────────────────────────────────────── */

type Tone = { name: string; token: string; note?: string; ring?: boolean };

/** A swatch column: the colour at the 6px radius, the token in mono, a note. */
function ToneChip({ name, token, note, ring }: Tone) {
  return (
    <div className="w-[7.5rem] min-w-0">
      <div
        className={`h-12 rounded-xs border ${ring ? 'border-border' : 'border-transparent'}`}
        style={{ background: `var(${token})` }}
      />
      <div className="mt-2 truncate text-sm text-fg">{name}</div>
      <div className="figures mt-0.5 truncate text-[11px] text-fg-subtle">{token}</div>
      {note ? <div className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{note}</div> : null}
    </div>
  );
}

const PALETTE: Tone[] = [
  { name: 'White', token: '--op-white', ring: true },
  { name: 'Gray 50', token: '--op-gray-50', ring: true },
  { name: 'Gray 100', token: '--op-gray-100', ring: true },
  { name: 'Gray 200', token: '--op-gray-200', ring: true },
  { name: 'Gray 300', token: '--op-gray-300' },
  { name: 'Gray 400', token: '--op-gray-400' },
  { name: 'Gray 500', token: '--op-gray-500' },
  { name: 'Gray 600', token: '--op-gray-600' },
  { name: 'Gray 700', token: '--op-gray-700' },
  { name: 'Gray 800', token: '--op-gray-800' },
  { name: 'Gray 850', token: '--op-gray-850' },
  { name: 'Gray 900', token: '--op-gray-900' },
  { name: 'Gray 950', token: '--op-gray-950' },
  { name: 'Black', token: '--op-black' },
];

const CHROMA: Tone[] = [
  { name: 'Blue 400', token: '--op-blue-400', note: 'links, dark' },
  { name: 'Blue 500', token: '--op-blue-500', note: 'the action blue' },
  { name: 'Blue 600', token: '--op-blue-600', note: 'links, light' },
  { name: 'Green 500', token: '--op-green-500', note: 'running' },
  { name: 'Amber 500', token: '--op-amber-500', note: 'needs input' },
  { name: 'Red 500', token: '--op-red-500', note: 'failed' },
  { name: 'Green 700', token: '--op-green-700', note: 'terminal text' },
  { name: 'Amber 700', token: '--op-amber-700', note: 'terminal text' },
  { name: 'Red 700', token: '--op-red-700', note: 'terminal text' },
  { name: 'Teal 500', token: '--op-teal-500', note: 'chart 2' },
  { name: 'Violet 500', token: '--op-violet-500', note: 'chart 3' },
];

const SEMANTIC: [string, Tone[]][] = [
  [
    'Surfaces',
    [
      { name: 'Canvas', token: '--canvas', ring: true },
      { name: 'Card', token: '--card', ring: true },
      { name: 'Popover', token: '--popover', ring: true },
      { name: 'Sidebar', token: '--sidebar', ring: true },
      { name: 'Field', token: '--field', ring: true },
      { name: 'Control', token: '--control', ring: true },
    ],
  ],
  [
    'Text',
    [
      { name: 'Foreground', token: '--fg' },
      { name: 'Muted', token: '--fg-muted' },
      { name: 'Subtle', token: '--fg-subtle' },
      { name: 'Inverted', token: '--fg-inverted', ring: true },
    ],
  ],
  [
    'Hairlines',
    [
      { name: 'Border', token: '--border' },
      { name: 'Subtle', token: '--border-subtle' },
      { name: 'Strong', token: '--border-strong' },
    ],
  ],
  [
    'The two blues',
    [
      { name: 'Primary', token: '--primary', note: 'one per view' },
      { name: 'Link', token: '--link' },
      { name: 'Ring', token: '--ring' },
      { name: 'Selected', token: '--selected-surface', ring: true },
    ],
  ],
  [
    'Status, never decoration',
    [
      { name: 'Success', token: '--success' },
      { name: 'Warning', token: '--warning' },
      { name: 'Danger', token: '--danger' },
      { name: 'Info', token: '--info' },
      { name: 'Success surface', token: '--success-surface', ring: true },
      { name: 'Warning surface', token: '--warning-surface', ring: true },
      { name: 'Danger surface', token: '--danger-surface', ring: true },
      { name: 'Info surface', token: '--info-surface', ring: true },
    ],
  ],
  [
    'Terminal',
    [
      { name: 'Background', token: '--term-bg', ring: true },
      { name: 'Text', token: '--term-fg' },
      { name: 'Dim', token: '--term-dim' },
      { name: 'Accent', token: '--term-accent' },
      { name: 'Success', token: '--term-success' },
      { name: 'Warning', token: '--term-warning' },
      { name: 'Danger', token: '--term-danger' },
      { name: 'Selection', token: '--term-selection', ring: true },
    ],
  ],
  [
    'Data series, in order',
    [
      { name: 'Chart 1', token: '--chart-1' },
      { name: 'Chart 2', token: '--chart-2' },
      { name: 'Chart 3', token: '--chart-3' },
      { name: 'Chart 4', token: '--chart-4' },
      { name: 'Chart 5', token: '--chart-5' },
    ],
  ],
];

export function Palette() {
  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <div className="eyebrow mb-3">Neutrals</div>
        <div className="flex flex-wrap gap-3">
          {PALETTE.map((t) => (
            <ToneChip key={t.token} {...t} />
          ))}
        </div>
      </div>
      <div>
        <div className="eyebrow mb-3">Chromatics</div>
        <div className="flex flex-wrap gap-3">
          {CHROMA.map((t) => (
            <ToneChip key={t.token} {...t} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SemanticColors() {
  return (
    <ThemePair>
      <div className="flex flex-col gap-6">
        {SEMANTIC.map(([group, tones]) => (
          <div key={group}>
            <div className="eyebrow mb-3">{group}</div>
            <div className="flex flex-wrap gap-3">
              {tones.map((t) => (
                <ToneChip key={t.token} {...t} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </ThemePair>
  );
}

/* ── Typography ──────────────────────────────────────────────────────────── */

const TYPE_LADDER: [string, string, string, string][] = [
  ['text-display', '76 · 1.04 · -0.028em', 'font-display font-semibold', 'Every agent, one control plane.'],
  ['text-display-sm', '52 · 1.07 · -0.024em', 'font-display font-semibold', 'Simple but powerful'],
  ['text-h1', '40 · 1.10 · -0.021em', 'font-display font-semibold', 'Set a new password'],
  ['text-h2', '28 · 1.15 · -0.016em', 'font-display font-semibold', 'New session'],
  ['text-h3', '21 · 1.24 · -0.011em', 'font-semibold', "You're set up"],
  ['text-h4', '17 · 1.35 · -0.008em', 'font-semibold', 'Install command'],
  ['text-lg', '17 · 1.47 · -0.016em', '', 'Lead: sign in to reach your workspaces.'],
  ['text-base', '15 · 1.47 · -0.011em', '', 'Read: a host is a server you control. Sessions run there.'],
  ['text-operate', '14 · 1.40 · -0.008em', '', 'Operate: buttons, menu rows, list items, inputs.'],
  ['text-sm', '13 · 1.38 · -0.006em', '', 'Support: labels, chips, captions.'],
  ['text-xs', '12 · 1.33 · -0.003em', '', 'Annotate: hints, meta, timestamps.'],
  ['text-micro', '11 · 1.27 · +0.02em', 'uppercase font-medium text-fg-subtle', 'Eyebrow · sessions · 3 of 4'],
];

export function TypeLadder() {
  return (
    <div className="flex w-full flex-col gap-5">
      {TYPE_LADDER.map(([cls, spec, extra, sample]) => (
        <div key={cls} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
          <span className="figures w-40 shrink-0 text-[11px] text-fg-subtle">
            {cls}
            <br />
            <span className="text-fg-subtle/70">{spec}</span>
          </span>
          <span className={`${cls} ${extra} min-w-0 text-fg`}>{sample}</span>
        </div>
      ))}
      <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-6">
        <span className="figures w-40 shrink-0 text-[11px] text-fg-subtle">
          text-metric
          <br />
          <span className="text-fg-subtle/70">32 · 1.05 · mono</span>
        </span>
        <span className="figures text-metric text-fg">
          98.2<span className="text-[0.55em] text-fg-muted">%</span> &nbsp; 812
          <span className="text-[0.55em] text-fg-muted">ms</span> &nbsp; 6,420 / 10,000
        </span>
      </div>
    </div>
  );
}

export function Weights() {
  return (
    <div className="flex w-full flex-wrap gap-8">
      {[
        ['400', 'font-normal', 'Regular carries reading text.'],
        ['500', 'font-medium', 'Medium carries labels and controls.'],
        ['600', 'font-semibold', 'Semibold is the ceiling; 700 reads as panic.'],
      ].map(([w, cls, copy]) => (
        <div key={w} className="min-w-[14rem] flex-1">
          <div className={`text-h3 ${cls}`}>{copy}</div>
          <div className="figures mt-2 text-[11px] text-fg-subtle">{cls} · {w}</div>
        </div>
      ))}
      <div className="w-full">
        <div className="figures text-base text-fg">
          SF Mono sets every number a human compares: <span className="text-term-accent">$</span> gh
          auth login --web · opk_7f3a9c · 763.4 MB
        </div>
        <div className="figures mt-2 text-[11px] text-fg-subtle">figures · SF Mono · tabular-nums</div>
      </div>
    </div>
  );
}

/* ── Space ───────────────────────────────────────────────────────────────── */

const SPACE = [2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 60, 80];

export function SpaceScale() {
  return (
    <div className="flex w-full flex-col gap-2">
      {SPACE.map((px) => (
        <div key={px} className="flex items-center gap-4">
          <span className="figures w-10 text-right text-[11px] text-fg-subtle">{px}</span>
          <span
            className="h-3 rounded-[1px] bg-primary/80"
            style={{ width: px * 3, minWidth: 2 }}
          />
          {px >= 40 ? <span className="text-[11px] text-fg-subtle">page rhythm</span> : null}
        </div>
      ))}
      <p className="mt-3 max-w-[60ch] text-xs text-fg-subtle">
        4px base. Product UI lives between 4 and 24; 40 to 80 is page and section rhythm. If two
        blocks seem to need a line between them, add 24px instead.
      </p>
    </div>
  );
}

export function ControlRamp() {
  return (
    <div className="flex w-full flex-wrap items-end gap-8">
      {[
        ['sm', '28px', '--control-h-sm'],
        ['md', '34px', '--control-h-md'],
        ['lg', '42px', '--control-h-lg'],
      ].map(([name, px, token]) => (
        <div key={name} className="flex flex-col items-start gap-2">
          <div
            className="flex items-center rounded-pill bg-control px-4 text-operate text-control-fg"
            style={{ height: `var(${token})` }}
          >
            {name} · {px}
          </div>
          <span className="figures text-[11px] text-fg-subtle">{token}</span>
        </div>
      ))}
      <p className="w-full max-w-[60ch] text-xs text-fg-subtle">
        One height ramp for every interactive element, so a Button, an Input and a ChipSelect sit on
        a row without adjustment. Sidebar 264px, collapsed 60px; top bar 56px.
      </p>
    </div>
  );
}

/* ── Radii ───────────────────────────────────────────────────────────────── */

const RADII: [string, string, string][] = [
  ['6px', 'rounded-xs', 'swatches, inline code, kbd'],
  ['10px', 'rounded-sm', 'anything you type into, menu rows'],
  ['14px', 'rounded-md', 'menus, popovers, chip selects'],
  ['18px', 'rounded-lg', 'cards, the composer'],
  ['28px', 'rounded-xl', 'modals, hero surfaces'],
  ['980px', 'rounded-pill', 'anything you press'],
];

export function Radii() {
  return (
    <div className="flex w-full flex-wrap gap-6">
      {RADII.map(([px, cls, usage]) => (
        <div key={cls} className="flex flex-col items-start gap-2">
          <div className={`h-16 w-28 border border-border bg-card ${cls}`} />
          <span className="figures text-[11px] text-fg-subtle">
            {cls} · {px}
          </span>
          <span className="max-w-28 text-xs leading-snug text-fg-muted">{usage}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Elevation ───────────────────────────────────────────────────────────── */

export function Elevation() {
  return (
    <ThemePair>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-border-subtle bg-card text-xs text-fg-muted">
            card · no shadow
          </div>
          <span className="figures text-[11px] text-fg-subtle">tonal: card on canvas</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex h-24 w-40 items-center justify-center rounded-md bg-popover text-xs text-fg-muted shadow-popover">
            popover
          </div>
          <span className="figures text-[11px] text-fg-subtle">shadow-popover</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex h-24 w-40 items-center justify-center rounded-xl bg-popover text-xs text-fg-muted shadow-modal">
            modal
          </div>
          <span className="figures text-[11px] text-fg-subtle">shadow-modal</span>
        </div>
      </div>
    </ThemePair>
  );
}

/* ── Motion ──────────────────────────────────────────────────────────────── */

export function Motion() {
  return (
    <div className="flex w-full flex-col gap-3">
      {DURATIONS.map(([name, ms, use]) => (
        <div key={name} className="group flex items-center gap-4">
          <span className="figures w-28 text-[11px] text-fg-subtle">
            duration-{name} · {ms}
          </span>
          <span className="relative h-2 w-48 overflow-hidden rounded-pill bg-control">
            <span
              className="absolute inset-y-0 left-0 w-1/3 rounded-pill bg-primary transition-transform ease-standard group-hover:translate-x-[200%]"
              style={{ transitionDuration: ms }}
            />
          </span>
          <span className="text-xs text-fg-muted">{use}</span>
        </div>
      ))}
      <p className="mt-2 max-w-[60ch] text-xs text-fg-subtle">
        Hover a row. Short, eased, never bouncy: cubic-bezier(.4,0,.2,1) standard,
        cubic-bezier(.16,1,.3,1) on entry. Menus and dialogs rise 4px and fade; nothing slides in
        from an edge. Everything collapses to 0ms under prefers-reduced-motion.
      </p>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

/** The glyphs the MVP screens use, from Lucide, 2px stroke, currentColor. */
export const ICON_NAMES = [
  'terminal',
  'git-branch',
  'folder',
  'cpu',
  'bot',
  'server',
  'plus',
  'search',
  'settings-2',
  'chevron-down',
  'chevron-right',
  'chevron-left',
  'arrow-up',
  'arrow-left',
  'x',
  'check',
  'copy',
  'eye',
  'eye-off',
  'paperclip',
  'mic',
  'square',
  'play',
  'pause',
  'refresh-cw',
  'log-out',
  'moon',
  'sun',
  'globe',
  'user-round',
  'mail',
  'lock',
  'link',
  'external-link',
  'info',
  'triangle-alert',
  'circle-check',
  'circle-x',
  'clock',
  'ellipsis',
  'panel-left',
  'filter',
] as const;

function pascal(name: string) {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function Icons() {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
      {ICON_NAMES.map((name) => {
        const Glyph = LUCIDE[pascal(name) as keyof typeof LUCIDE];
        if (!Glyph) return null;
        return (
          <div
            key={name}
            title={name}
            className="flex flex-col items-center gap-2 rounded-sm border border-border-subtle bg-card px-1.5 py-3.5"
          >
            <Glyph className="size-4 text-fg" />
            <span className="figures text-center text-[10.5px] leading-tight break-words text-fg-subtle">
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
