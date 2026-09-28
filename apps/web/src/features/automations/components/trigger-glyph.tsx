import { BrandGlyph } from '@oppenheimer/design-system-web';
import { Clock } from '@oppenheimer/design-system-web/icons';

/**
 * An automation's glyph: a clock when only schedules start it, GitHub's mark
 * when an event can. The frames draw the one or the other, never both.
 */
export function TriggerGlyph({ scheduled, size = 13 }: { scheduled: boolean; size?: number }) {
  return scheduled ? <Clock /> : <BrandGlyph name="github" size={size} />;
}
