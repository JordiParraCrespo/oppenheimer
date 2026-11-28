import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { SectionBotsSearchSkeleton } from '@/features/bots/components/section-bots-search-skeleton';
import { SectionBotsSkeleton } from './section-bots-skeleton';

/** `SearchableSectionBots` before its code has arrived: the heading's skeleton with Search bots in it. */
export function SearchableSectionBotsSkeleton({ section }: { section: BotSection }) {
  return <SectionBotsSkeleton section={section} search={<SectionBotsSearchSkeleton />} />;
}
