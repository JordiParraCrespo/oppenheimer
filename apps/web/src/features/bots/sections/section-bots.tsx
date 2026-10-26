import { BotList, SidebarListHead, Skeleton } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { NewBotButton } from './new-bot-button';
import { SectionBotsList } from './section-bots-list';

/**
 * The Bots heading a console section's sidebar carries beside its own list
 * (`product/versions/mvp/28-bots-in-sections.md`, drawn on every console frame
 * of the 2026-10-25 export): the bots placed in `section`, and a plus that
 * makes one there. The heading needs no read and stays in every state; the
 * rows are read under Suspense.
 */
export function SectionBots({ section }: { section: BotSection }) {
  const { t } = useTranslation();

  return (
    <section aria-label={t('bots.section.heading')} className="pb-3">
      <SidebarListHead label={t('bots.section.heading')}>
        <NewBotButton section={section} size="xs" />
      </SidebarListHead>
      <QueryState>
        <QueryState.Pending>
          <BotList className="mx-1.5">
            <Skeleton shape="sm" className="h-13 w-full" />
          </BotList>
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.sidebar.loadFailed')} className="mx-3" />
        <QueryState.Data>
          <SectionBotsList section={section} />
        </QueryState.Data>
      </QueryState>
    </section>
  );
}
