import type { AvatarColor } from '../components/avatar-picker';
import { cn } from '../lib/utils';

const INK = 'var(--avatar-ink)';
const EDGE = '#fff';

/** One shape of a hat and what it is made of: ink, a felt in the face's colour, or the blue band. */
type HatShape = { d: string; tone: 'ink' | 'felt' | 'band' };

/**
 * The hats, as data: the same shapes are drawn twice, first as the sticker's
 * white margin under the face, then in their tones over it. A band sits
 * inside its hat's silhouette, so the margin leaves it out.
 */
const HAT_SHAPES = {
  fedora: [
    { tone: 'ink', d: 'M19.5 22 22 8.8c.6-3.2 3-4.4 5.7-3.4L32 7l4.3-1.6c2.7-1 5.1.2 5.7 3.4L44.5 22Z' },
    { tone: 'band', d: 'M19.4 18.6h25.2v3.4H19.4Z' },
    { tone: 'ink', d: 'M5 25c0-1.8 5-2.3 12-2h30c7-.3 12 .2 12 2 0 1.5-3 2.4-8 3H13c-5-.6-8-1.5-8-3Z' },
  ],
  porkpie: [
    { tone: 'ink', d: 'M20.5 22 22 10c.2-1.7 1.4-2.6 3-2.6h14c1.6 0 2.8.9 3 2.6L43.5 22Z' },
    { tone: 'band', d: 'M20.3 18.6h23.4v3.4H20.3Z' },
    {
      tone: 'ink',
      d: 'M8 25.2c0-1.6 4.5-2 10.5-1.8h27c6-.2 10.5.2 10.5 1.8 0 1.5-3 2.3-7 2.8H15c-4-.5-7-1.3-7-2.8Z',
    },
  ],
  bowler: [
    { tone: 'ink', d: 'M17 25a15 15 0 0 1 30 0Z' },
    { tone: 'band', d: 'M17 21.5h30V25H17Z' },
    { tone: 'ink', d: 'M11 26.5c0-1.6 9-2.3 21-2.3s21 .7 21 2.3-9 2.5-21 2.5-21-.9-21-2.5Z' },
  ],
  tophat: [
    { tone: 'ink', d: 'M22 3h20a2 2 0 0 1 2 2v19H20V5a2 2 0 0 1 2-2Z' },
    { tone: 'band', d: 'M20 17h24v4H20Z' },
    { tone: 'ink', d: 'M13.5 23h37a2.5 2.5 0 0 1 0 5h-37a2.5 2.5 0 0 1 0-5Z' },
  ],
  cap: [
    { tone: 'ink', d: 'M13 28a19 18 0 0 1 38 0Z' },
    { tone: 'ink', d: 'M40 27h17c0 2.5-2 4-5 4H38Z' },
    { tone: 'band', d: 'M30 10.5a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z' },
  ],
  beanie: [
    { tone: 'felt', d: 'M13 27a19 17 0 0 1 38 0Z' },
    { tone: 'ink', d: 'M14.5 24h35a3.5 3.5 0 0 1 0 7h-35a3.5 3.5 0 0 1 0-7Z' },
    { tone: 'felt', d: 'M27.5 9a4.5 4.5 0 1 0 9 0 4.5 4.5 0 1 0-9 0Z' },
  ],
} satisfies Record<string, HatShape[]>;

/** The parts a face is made of, in the order a picker offers them. */
const FACE_HATS = Object.keys(HAT_SHAPES) as (keyof typeof HAT_SHAPES)[];
const FACE_EYES = ['dots', 'happy', 'wink', 'big'] as const;
const FACE_MOUTHS = ['smile', 'grin', 'o'] as const;

/** A face, part by part: what a bot's owner picks, or what its id picks for it. */
type BotFaceParts = {
  hat: keyof typeof HAT_SHAPES;
  eyes: (typeof FACE_EYES)[number];
  mouth: (typeof FACE_MOUTHS)[number];
};
type Face = BotFaceParts;
const HATS = FACE_HATS;
const EYES = FACE_EYES;
const MOUTHS = FACE_MOUTHS;

/** FNV-1a: the same seed always picks the same face. */
function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function faceFor(seed: string): Face {
  const h = hash(seed);
  return {
    hat: HATS[h % HATS.length] as Face['hat'],
    eyes: EYES[Math.floor(h / HATS.length) % EYES.length] as Face['eyes'],
    mouth: MOUTHS[Math.floor(h / (HATS.length * EYES.length)) % MOUTHS.length] as Face['mouth'],
  };
}

/** A hat's shapes, as the white margin (`edge`) or in their tones. */
function Hat({ hat, color, edge }: { hat: Face['hat']; color: string; edge?: boolean }) {
  const tones = { ink: INK, felt: `color-mix(in oklch, ${color} 70%, black)`, band: 'var(--primary)' };
  const shapes: HatShape[] = HAT_SHAPES[hat];
  return (
    <>
      {shapes.map((shape) =>
        edge ? (
          shape.tone === 'band' ? null : (
            <path
              key={shape.d}
              d={shape.d}
              fill={EDGE}
              stroke={EDGE}
              strokeWidth={7}
              strokeLinejoin="round"
            />
          )
        ) : (
          <path key={shape.d} d={shape.d} fill={tones[shape.tone]} />
        ),
      )}
    </>
  );
}

function Eyes({ eyes }: { eyes: Face['eyes'] }) {
  const arc = (x: number) => (
    <path
      d={`M${x - 4.5} 40.5q4.5-6 9 0`}
      fill="none"
      stroke={INK}
      strokeWidth={3.2}
      strokeLinecap="round"
    />
  );
  const dot = (x: number) => (
    <>
      <circle cx={x} cy={39} r={3.4} fill={INK} />
      <circle cx={x + 1.1} cy={37.9} r={1} fill={EDGE} />
    </>
  );
  switch (eyes) {
    case 'dots':
      return (
        <>
          {dot(25)}
          {dot(39)}
        </>
      );
    case 'happy':
      return (
        <>
          {arc(25)}
          {arc(39)}
        </>
      );
    case 'wink':
      return (
        <>
          {dot(25)}
          {arc(39)}
        </>
      );
    case 'big':
      return (
        <>
          <circle cx={24.5} cy={39} r={5.6} fill={EDGE} />
          <circle cx={39.5} cy={39} r={5.6} fill={EDGE} />
          <circle cx={25.4} cy={39.8} r={3} fill={INK} />
          <circle cx={40.4} cy={39.8} r={3} fill={INK} />
        </>
      );
  }
}

function Mouth({ mouth }: { mouth: Face['mouth'] }) {
  switch (mouth) {
    case 'smile':
      return <path d="M27 47q5 4.5 10 0" fill="none" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />;
    case 'grin':
      return <path d="M26 46h12q0 6-6 6t-6-6Z" fill={INK} />;
    case 'o':
      return <ellipse cx={32} cy={48} rx={2.5} ry={2.9} fill={INK} />;
  }
}

/**
 * BotFace — a bot's drawn face while it has no photo: a round face in its
 * avatar colour wearing a hat, cut out like a sticker (a white margin) on a
 * darker shade of the same colour. The hat, the eyes and the mouth are the
 * `parts` its owner picked, or else come from `seed`, so a bot keeps its face
 * for as long as it keeps its seed. Flat
 * colour only; it fills its box (`size-full`, so a slot's own svg sizing
 * passes it by) and lets the avatar clip it.
 */
function BotFace({
  seed,
  color,
  parts,
  className,
}: {
  seed: string;
  color: AvatarColor;
  /** The face its owner picked; without it, the one `seed` picks. */
  parts?: BotFaceParts | null;
  className?: string;
}) {
  const face = parts ?? faceFor(seed);
  const fill = `var(--avatar-${color})`;
  return (
    <svg
      data-slot="bot-face"
      data-hat={face.hat}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn('size-full', className)}
    >
      <rect width="64" height="64" fill={`color-mix(in oklch, ${fill} 70%, black)`} />
      <g transform="translate(5.5 6.5) scale(.83)">
        <circle cx="32" cy="40" r="20" fill={EDGE} stroke={EDGE} strokeWidth={7} />
        <Hat hat={face.hat} color={fill} edge />
        <circle cx="32" cy="40" r="20" fill={fill} />
        <Eyes eyes={face.eyes} />
        <Mouth mouth={face.mouth} />
        <Hat hat={face.hat} color={fill} />
      </g>
    </svg>
  );
}

export { BotFace, FACE_EYES, FACE_HATS, FACE_MOUTHS, faceFor };
export type { BotFaceParts };
