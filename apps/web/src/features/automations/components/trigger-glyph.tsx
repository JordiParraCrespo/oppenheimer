import { BrandGlyph } from '@oppenheimer/design-system-web';
import { Clock } from '@oppenheimer/design-system-web/icons';

/**
 * An automation's glyph: a clock when only schedules start it, GitHub's mark
 * when an event can. The frames draw the one or the other, never both.
 * `className` reaches the GitHub mark only: the sidebar draws it in ink at
 * 80% where the clock stays subtle (`op-rrow`).
 */
export function TriggerGlyph({
  scheduled,
  size = 13,
  className,
}: {
  scheduled: boolean;
  size?: number;
  className?: string;
}) {
  // The mark takes the theme's ink; the dark filter would invert that ink (and
  // the running green) a second time.
  return scheduled ? (
    <Clock />
  ) : (
    <BrandGlyph name="github" size={size} flip={false} className={className} />
  );
}
