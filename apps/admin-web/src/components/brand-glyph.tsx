import { BrandMark, cn } from '@oppenheimer/design-system-web';

/**
 * The product mark, as it sits beside the wordmark on every auth screen.
 *
 * Drawn by the design system's `BrandMark` in `currentColor`, so it follows the
 * theme without an asset of its own. A deployment with a real logo replaces the
 * body of this one component and every screen picks it up.
 */
export function BrandGlyph({ className, ...props }: React.ComponentProps<'svg'>) {
  return <BrandMark size={28} className={cn('shrink-0', className)} {...props} />;
}
