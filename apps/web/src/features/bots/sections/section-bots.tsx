import { BotList, SidebarListHead, Skeleton } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNewBot } from '@/features/bots/hooks/use-create-bot';
import { withPlacement } from '@/features/bots/lib/placement';
import { SectionBotsList } from './section-bots-list';
import { SectionBotsMenu } from './section-bots-menu';

/**
 * The Bots heading a console section's sidebar carries beside its own list
 * (`product/versions/mvp/28-bots-in-sections.md`, drawn on every console frame
 * of the 2026-10-25 export): the bots placed in `section`, and a plus whose
 * menu makes one there or picks which of the others it lists. The heading
 * owns that menu's open state, since the empty line opens it too, and every
 * write to where a bot shows (the menu's checks, a row's Hide), so one alert
 * under the heading says when one fails. `saving` holds the placements in
 * flight, by bot, until each settles. The heading needs no read and stays in
 * every state; the rows are read under Suspense.
 */
export function SectionBots({ section }: { section: BotSection }) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState<ReadonlyMap<string, readonly BotSection[]>>(new Map());
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
      <SidebarListHead label={t('bots.section.heading')}>
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
      <QueryState>
        <QueryState.Pending>
          <BotList className="mx-1.5">
            <Skeleton shape="sm" className="h-13 w-full" />
          </BotList>
        </QueryState.Pending>
        <QueryState.Error fallback={t('bots.sidebar.loadFailed')} className="mx-3" />
        <QueryState.Data>
          <SectionBotsList
            section={section}
            onAdd={() => setMenuOpen(true)}
            onHide={(bot) => placeBot(bot, false)}
          />
        </QueryState.Data>
      </QueryState>
    </section>
  );
}
