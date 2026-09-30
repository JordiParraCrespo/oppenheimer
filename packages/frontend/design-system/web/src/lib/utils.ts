import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The type ladder's own names, as `styles/globals.css` declares them in
 * `@theme inline`.
 *
 * tailwind-merge only knows Tailwind's default `text-*` sizes and reads any
 * other as a *colour*: `cn('text-operate text-fg')` would return `text-fg`
 * alone, silently dropping the size wherever a colour followed it. Declaring
 * the names here keeps a size and a colour in one class list apart.
 *
 * `@shadcn/lint` has the same blind spot, so `oxlint.design.json` lists the
 * ladder's names as allowed under `no-raw-colors`: keep the two in step.
 */
const FONT_SIZES = [
  'micro',
  'operate',
  'body',
  'body-lg',
  'metric',
  'display',
  'display-sm',
  'h1',
  'h2',
  'h3',
  'h4',
  '12',
  '13',
  '14',
  '24',
];

/** The radii the system named, for the same reason (`--radius-pill` and co.). */
const RADII = ['pill', 'nav', 'tile', 'card'];

/** The elevations it named, likewise (`--shadow-panel` and co.). */
const SHADOWS = ['panel', 'popover', 'modal', 'menu'];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
      rounded: [{ rounded: RADII }],
      shadow: [{ shadow: SHADOWS }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
