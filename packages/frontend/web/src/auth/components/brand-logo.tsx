import { Wordmark } from '@oppenheimer/design-system-web';

/** The wordmark, as it sits top-left of every auth screen. */
export function BrandLogo({ className }: { className?: string }) {
  return <Wordmark className={className} />;
}
