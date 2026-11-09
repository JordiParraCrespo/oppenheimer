import { storedTexts } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';

/**
 * How many bots each section's Bots heading listed the last time it drew,
 * kept on this device, so its placeholder draws as many rows (or the empty
 * line) rather than a guess: three rows over an empty section, or one over
 * five, moved the whole sidebar under it when the list answered.
 */
export const sectionBotCounts = storedTexts('oppenheimer.sidebar.section-bots-count.');

/** The count `section` last drew on this device, or null before its first. */
export function rememberedBotCount(section: BotSection): number | null {
  const stored = Number.parseInt(sectionBotCounts.read(section), 10);
  return Number.isNaN(stored) ? null : stored;
}
