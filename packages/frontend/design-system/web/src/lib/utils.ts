import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The type ladder's own names, as `styles/globals.css` declares them in
 * `@theme inline`.
 *
 * tailwind-merge only knows Tailwind's default `text-*` sizes, so every name
 * the system added read to it as a *colour* instead: `cn('text-operate
 * text-fg')` returned `text-fg` alone, and the size was dropped from every
 * component that happened to name a colour after it — `SidebarMenuButton`,
 * `DropdownMenuItem`, `EmptyTitle`, `EmptyDescription` — each silently
 * inheriting the 15px read size where the artboards draw 14, 17 or 32.
 * Declaring the names here is what keeps a size and a colour in one class list
 * from being treated as one group.
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
