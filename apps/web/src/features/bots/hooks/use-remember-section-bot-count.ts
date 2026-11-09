import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useEffect } from 'react';
import { sectionBotCounts } from '@/features/bots/lib/section-bot-count';

/** Keeps how many bots `section` drew, for its next placeholder (`rememberedBotCount`). */
export function useRememberSectionBotCount(section: BotSection, count: number) {
  // Synchronises with the browser's storage, which outlives this page.
  useEffect(() => sectionBotCounts.write(section, String(count)), [section, count]);
}
