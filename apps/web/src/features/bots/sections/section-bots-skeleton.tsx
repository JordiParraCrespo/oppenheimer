import { IconButton, SidebarFoldLabel, SidebarListHead } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { SectionBotsRowsSkeleton } from '@/features/bots/components/section-bots-rows-skeleton';
import { useFoldedBots } from '@/features/bots/hooks/use-folded-bots';
import { rememberedBotCount } from '@/features/bots/lib/section-bot-count';

/**
 * `SectionBots` before its code has arrived: the Bots heading and its plus,
 * inert, over the rows it listed last time on this device
 * (`SectionBotsRowsSkeleton`), or the heading alone where the reader folded
 * the rows away. The sidebar beside it starts under its real height, so nothing
 * below moves when the heading's own code takes over.
 */
export function SectionBotsSkeleton({ section }: { section: BotSection }) {
  const { t } = useTranslation();
  const fold = useFoldedBots(section);

  return (
    <section aria-busy inert className="pb-3">
      <SidebarListHead
        label={
          <SidebarFoldLabel open={fold.open} onOpenChange={() => {}}>
            {t('bots.section.heading')}
          </SidebarFoldLabel>
        }
      >
        <IconButton variant="quiet" size="xs" aria-label={t('bots.section.heading')}>
          <Plus />
        </IconButton>
      </SidebarListHead>
      {fold.open ? <SectionBotsRowsSkeleton count={rememberedBotCount(section)} /> : null}
    </section>
  );
}
