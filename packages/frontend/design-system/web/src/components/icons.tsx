/**
 * Shared web icon set.
 *
 * The design system owns the icon library so that apps depend on a single,
 * centrally-versioned set instead of each declaring `lucide-react` themselves.
 * Import icons from `@oppenheimer/design-system-web/icons` rather than `lucide-react`
 * directly.
 *
 * @example
 * ```tsx
 * import { Flame } from '@oppenheimer/design-system-web/icons';
 *
 * <Flame className="size-4" />
 * ```
 */
export * from 'lucide-react';
export type { LucideIcon, LucideProps } from 'lucide-react';
