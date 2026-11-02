import { BOT_SECTIONS, type BotSection } from '@oppenheimer/shared/schemas/bot';

/**
 * `sections` with `section` shown or hidden, in catalog order: the whole set
 * a bot's update sends, since `sections` is replaced, never merged.
 */
export function withPlacement(
  sections: readonly BotSection[],
  section: BotSection,
  shown: boolean,
): BotSection[] {
  return BOT_SECTIONS.filter((each) => (each === section ? shown : sections.includes(each)));
}
