import { ChatTabStrip } from '@oppenheimer/design-system-web';
import { useBots, useSessions } from '@oppenheimer/frontend-consumer/react';
import { useNavigate } from '@tanstack/react-router';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOpenTabs } from '../hooks/use-open-tabs';
import { type OpenTab, openTabKey, openTabOf, tabAfterClosing } from '../lib/open-tabs';
import { SessionOpenTab } from './session-open-tab';
import { ShownSessionTab } from './shown-session-tab';

/**
 * The tabs over Sessions: every session and bot this device has open, the
 * page on screen among them, then New session. Opening one is arriving on
 * its page, from the sidebar or anywhere else; closing the one on screen
 * goes to its neighbour, the way a browser does, and closing the last goes
 * to New session.
 *
 * A tab whose session or bot is gone (deleted here or on another device)
 * is left off once the list it belongs to has answered without it; the page
 * on screen keeps its tab whatever the lists say, drawn from the session
 * itself (`ShownSessionTab`): one deleted and opened from an old link, one
 * just created, or any while the list loads or has failed. A bot's tab is
 * drawn by the route (`bot`): it is the bots feature's.
 */
export function SessionTabs({
  shown,
  bot,
}: {
  shown: OpenTab;
  bot: (botId: string, tab: { active: boolean; onClose: () => void }) => ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const shownKey = openTabKey(shown);
  const tabs = useOpenTabs(shownKey);
  const { data: sessions } = useSessions({
    select: (list) => new Map(list.map((session) => [session.id, session])),
  });
  const { data: botIds } = useBots({ select: (list) => new Set(list.map((one) => one.id)) });

  const drawn = tabs.keys.flatMap((key) => {
    const tab = openTabOf(key);
    if (!tab) return [];
    if (key === shownKey) return [{ key, tab }];
    if (tab.kind === 'session' && !sessions?.has(tab.id)) return [];
    if (tab.kind === 'bot' && !botIds?.has(tab.id)) return [];
    return [{ key, tab }];
  });
  const order = drawn.map((one) => one.key);

  const close = (key: string) => {
    const next = tabAfterClosing(order, shownKey, key);
    tabs.close(key);
    if (next === shownKey) return;
    const tab = next ? openTabOf(next) : null;
    if (!tab) void navigate({ to: '/sessions/new' });
    else if (tab.kind === 'session') {
      void navigate({ to: '/sessions/$sessionId', params: { sessionId: tab.id } });
    } else void navigate({ to: '/sessions/bots/$botId', params: { botId: tab.id } });
  };

  const sessionTab = (key: string, id: string) => {
    if (key === shownKey) {
      return <ShownSessionTab key={key} sessionId={id} onClose={() => close(key)} />;
    }
    const session = sessions?.get(id);
    return session ? (
      <SessionOpenTab key={key} session={session} active={false} onClose={() => close(key)} />
    ) : null;
  };

  return (
    <ChatTabStrip
      navigation
      label={t('sessions.tabs.label')}
      onNew={() => void navigate({ to: '/sessions/new' })}
      newLabel={t('sessions.tabs.new')}
      className="-ml-1"
    >
      {drawn.map(({ key, tab }) =>
        tab.kind === 'session' ? (
          sessionTab(key, tab.id)
        ) : (
          <Fragment key={key}>
            {bot(tab.id, { active: key === shownKey, onClose: () => close(key) })}
          </Fragment>
        ),
      )}
    </ChatTabStrip>
  );
}
