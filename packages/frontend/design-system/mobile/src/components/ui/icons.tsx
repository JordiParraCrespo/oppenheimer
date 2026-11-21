/**
 * Shared mobile icon set.
 *
 * The design system owns the icon library so that apps depend on a single,
 * centrally-versioned set instead of each declaring `lucide-react-native`
 * themselves. Import icons from `@oppenheimer/design-system-mobile/icons` rather than
 * `lucide-react-native` directly — this mirrors the web icon surface
 * (`@oppenheimer/design-system-web/icons`) so both platforms share one icon API.
 *
 * Use these raw icon components together with the {@link Icon} wrapper for
 * Nativewind `className` support:
 *
 * @example
 * ```tsx
 * import { Icon } from '@oppenheimer/design-system-mobile/icon';
 * import { ArrowRight } from '@oppenheimer/design-system-mobile/icons';
 *
 * <Icon as={ArrowRight} className="text-red-500" size={16} />
 * ```
 */
export * from 'lucide-react-native';
export type { LucideIcon, LucideProps } from 'lucide-react-native';
