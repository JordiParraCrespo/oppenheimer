import type * as React from 'react';

/** The avatar colours a face is drawn in; `AvatarColor` in `avatar-picker`. */
type FaceColor = 'mint' | 'tangerine' | 'snow' | 'sky' | 'lilac' | 'lemon' | 'coral' | 'moss';

const INK = 'var(--avatar-ink)';
const EDGE = '#fff';

const HATS = ['fedora', 'porkpie', 'bowler', 'tophat', 'cap', 'beanie'] as const;
const EYES = ['dots', 'happy', 'wink', 'big'] as const;
const MOUTHS = ['smile', 'grin', 'o'] as const;

type Face = {
  hat: (typeof HATS)[number];
  eyes: (typeof EYES)[number];
  mouth: (typeof MOUTHS)[number];
};

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

/**
 * The hat's shapes. `edge` draws them as the sticker's white margin: every
 * shape filled and stroked white, so the cut line follows the silhouette.
 */
function Hat({ hat, color, edge }: { hat: Face['hat']; color: string; edge?: boolean }) {
  const solid = (fill: string): React.SVGProps<SVGPathElement> =>
    edge ? { fill: EDGE, stroke: EDGE, strokeWidth: 7, strokeLinejoin: 'round' } : { fill };
  const band = 'var(--primary)';
  const felt = `color-mix(in oklch, ${color} 70%, black)`;
  switch (hat) {
    case 'fedora':
      return (
        <>
          <path {...solid(INK)} d="M19.5 22 22 8.8c.6-3.2 3-4.4 5.7-3.4L32 7l4.3-1.6c2.7-1 5.1.2 5.7 3.4L44.5 22Z" />
          {edge ? null : <path fill={band} d="M19.4 18.6h25.2v3.4H19.4Z" />}
          <path {...solid(INK)} d="M5 25c0-1.8 5-2.3 12-2h30c7-.3 12 .2 12 2 0 1.5-3 2.4-8 3H13c-5-.6-8-1.5-8-3Z" />
        </>
      );
    case 'porkpie':
      return (
        <>
          <path
            {...solid(INK)}
            d="M20.5 22 22 10c.2-1.7 1.4-2.6 3-2.6h14c1.6 0 2.8.9 3 2.6L43.5 22Z"
          />
          {edge ? null : <path fill={band} d="M20.3 18.6h23.4v3.4H20.3Z" />}
          <path
            {...solid(INK)}
            d="M8 25.2c0-1.6 4.5-2 10.5-1.8h27c6-.2 10.5.2 10.5 1.8 0 1.5-3 2.3-7 2.8H15c-4-.5-7-1.3-7-2.8Z"
          />
        </>
      );
    case 'bowler':
      return (
        <>
          <path {...solid(INK)} d="M17 25a15 15 0 0 1 30 0Z" />
          {edge ? null : <path fill={band} d="M17 21.5h30V25H17Z" />}
          <path {...solid(INK)} d="M11 26.5c0-1.6 9-2.3 21-2.3s21 .7 21 2.3-9 2.5-21 2.5-21-.9-21-2.5Z" />
        </>
      );
    case 'tophat':
      return (
        <>
          <path {...solid(INK)} d="M22 3h20a2 2 0 0 1 2 2v19H20V5a2 2 0 0 1 2-2Z" />
          {edge ? null : <path fill={band} d="M20 17h24v4H20Z" />}
          <path {...solid(INK)} d="M13.5 23h37a2.5 2.5 0 0 1 0 5h-37a2.5 2.5 0 0 1 0-5Z" />
        </>
      );
    case 'cap':
      return (
        <>
          <path {...solid(INK)} d="M13 28a19 18 0 0 1 38 0Z" />
          <path {...solid(INK)} d="M40 27h17c0 2.5-2 4-5 4H38Z" />
          {edge ? null : <circle fill={band} cx="32" cy="10.5" r="2" />}
        </>
      );
    case 'beanie':
      return (
        <>
          <path {...solid(felt)} d="M13 27a19 17 0 0 1 38 0Z" />
          <path {...solid(INK)} d="M14.5 24h35a3.5 3.5 0 0 1 0 7h-35a3.5 3.5 0 0 1 0-7Z" />
          <circle {...(solid(felt) as React.SVGProps<SVGCircleElement>)} cx="32" cy="9" r="4.5" />
        </>
      );
  }
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
 * darker shade of the same colour. The hat, the eyes and the mouth come from
 * `seed`, so a bot keeps its face for as long as it keeps its seed. Flat
 * colour only; it fills its box and lets the avatar clip it.
 */
function BotFace({ seed, color, className }: { seed: string; color: FaceColor; className?: string }) {
  const face = faceFor(seed);
  const fill = `var(--avatar-${color})`;
  return (
    <svg
      data-slot="bot-face"
      data-hat={face.hat}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className}
      width="100%"
      height="100%"
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

export { BotFace, faceFor };
