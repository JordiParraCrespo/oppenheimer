import {
  SidebarFoldLabel,
  SidebarFoldPanel,
  SidebarListHead,
} from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionBotsRowsSkeleton } from '@/features/bots/components/section-bots-rows-skeleton';
import { useNewBot } from '@/features/bots/hooks/use-create-bot';
import { useFoldedBots } from '@/features/bots/hooks/use-folded-bots';
import { withPlacement } from '@/features/bots/lib/placement';
import { rememberedBotCount } from '@/features/bots/lib/section-bot-count';
import { SectionBotFaces } from './section-bot-faces';
import { SectionBotsList } from './section-bots-list';
import { SectionBotsMenu } from './section-bots-menu';

/**
 * The Bots heading a console section's sidebar carries beside its own list:
 * the bots placed in `section`, and a plus whose menu makes one there or
 * picks which of the others it lists. The heading owns that menu's open
 * state, since the empty line opens it too, and every write to where a bot
 * shows (the menu's checks, a row's Hide), so one alert under the heading
 * says when one fails. `saving` holds the placements in flight, by bot,
 * until each settles. The heading needs no read and stays in every state;
 * the rows are read under Suspense. The label folds the rows away
 * (`useFoldedBots`), the panel closing on its height, and a fold leaves the bots' faces beside the label
 * (`SectionBotFaces`), the plus and its alerts.
 *
 * A `search` is drawn at the top of the panel, so it folds away with the
 * rows and shows only while they do; `query`, its settled value, narrows the
 * rows. A heading with neither lists every bot (`SearchableSectionBots` is
 * the one that searches).
 */
export function SectionBots({
  section,
  search,
  query = '',
}: {
  section: BotSection;
  search?: ReactNode;
  query?: string;
}) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState<ReadonlyMap<string, readonly BotSection[]>>(new Map());
  const fold = useFoldedBots(section);
  const newBot = useNewBot(section);
  const place = useUpdateBot({
    onSettled: (_saved, _error, { id }) =>
      setSaving((current) => {
        const next = new Map(current);
        next.delete(id);
        return next;
      }),
  });
  const placeBot = (bot: BotEntity, shown: boolean) => {
    const sections = withPlacement(bot.sections, section, shown);
    setSaving((current) => new Map(current).set(bot.id, sections));
    place.mutate({ id: bot.id, input: { sections } });
  };

  return (
    <section aria-label={t('bots.section.heading')} className="pb-3">
      <SidebarListHead
        label={
          <SidebarFoldLabel open={fold.open} onOpenChange={fold.setOpen}>
            {t('bots.section.heading')}
          </SidebarFoldLabel>
        }
        summary={
          fold.open ? null : (
            <SectionBotFaces section={section} onUnfold={() => fold.setOpen(true)} />
          )
        }
      >
        <SectionBotsMenu
          section={section}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          creating={newBot.pending}
          onCreate={newBot.create}
          saving={saving}
          onPlace={placeBot}
        />
      </SidebarListHead>
      <ErrorAlert
        error={newBot.error}
        fallback={t('bots.sidebar.createFailed')}
        onDismiss={newBot.reset}
        className="mx-3 mb-2"
      />
      <ErrorAlert
        error={place.error}
        fallback={t('bots.settings.profile.showsInFailed')}
        onDismiss={() => place.reset()}
        className="mx-3 mb-2"
      />
      <SidebarFoldPanel open={fold.open}>
        {search}
        <QueryState>
          <QueryState.Pending>
            <SectionBotsRowsSkeleton count={rememberedBotCount(section)} />
          </QueryState.Pending>
          <QueryState.Error fallback={t('bots.sidebar.loadFailed')} className="mx-3" offlineOnce />
          <QueryState.Data>
            <SectionBotsList
              section={section}
              onAdd={() => setMenuOpen(true)}
              onHide={(bot) => placeBot(bot, false)}
              query={query}
            />
          </QueryState.Data>
        </QueryState>
      </SidebarFoldPanel>
    </section>
  );
}
