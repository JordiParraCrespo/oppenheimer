import { BrandMark } from '@oppenheimer/design-system-mobile/brand-mark';
import { cn } from '@oppenheimer/design-system-mobile/utils';

/**
 * The product mark, as it sits beside the wordmark on every auth screen.
 *
 * Drawn by the design system's `BrandMark` in the ink around it, so it follows
 * the theme without an asset of its own. A deployment with a real logo replaces
 * the body of this one component and every screen picks it up — the web kit's
 * `BrandGlyph` is the same component for the same reason.
 */
export function BrandGlyph({ className, ...props }: React.ComponentProps<typeof BrandMark>) {
  return <BrandMark size={28} className={cn('text-ink-900', className)} {...props} />;
}
