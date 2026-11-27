import {
  ChatTab,
  ChatTabSkeleton,
  ChatTabStrip,
  DragProvider,
  SortableChatTab,
  SortableGroup,
  useSortableGroups,
} from '@oppenheimer/design-system-web';
import { PlusIcon } from '@oppenheimer/design-system-web/icons';
import { useDragLabels } from '@oppenheimer/frontend-web';
import { Link, useNavigate } from '@tanstack/react-router';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDrawnTabs } from '../hooks/use-drawn-tabs';
import { type OpenTab, openTabKey, openTabOf, tabAfterClosing } from '../lib/open-tabs';
import { SessionOpenTab } from './session-open-tab';
import { ShownSessionTab } from './shown-session-tab';

/** The `SortableGroup` the open tabs sit in. */
const TABS_GROUP = 'tabs';

/**
 * The tabs over Sessions: every session and bot this device has open, the
 * page on screen among them, then New session. Opening one is arriving on
 * its page, from the sidebar or anywhere else; closing the one on screen
 * goes to its neighbour, the way a browser does, and closing the last goes
 * to New session.
 *
 * The reader drags a tab into another place (a click still opens it, a drag
 * starts past 5px), and the strip keeps that order on this device with the
 * tabs themselves (`useOpenTabs`), so it outlives the page.
 *
 * New session keeps the strip, the tabs open as they were, and ends it with
 * a lit New session tab of its own, which is not kept: the plus that leads
 * there steps aside while it shows, its room kept so the tabs keep their
 * width when the session is created, and leaving the page leaves no tab.
 *
 * A tab whose session or bot is gone (deleted here or on another device)
 * is left off once the list it belongs to has answered without it; until a
 * list answers, its tabs hold their places as placeholders, so the strip
 * does not reflow when it lands; the page
 * on screen keeps its tab whatever the lists say, drawn from the session
 * itself (`ShownSessionTab`): one deleted and opened from an old link, one
 * just created, or any while the list loads or has failed. A bot's tab is
 * drawn by the route (`bot`): it is the bots feature's.
 */
export function SessionTabs({
  shown,
  bot,
}: {
  /** The page on screen; null on New session, which opens no tab. */
  shown: OpenTab | null;
  bot: (botId: string, tab: { active: boolean; onClose: () => void }) => ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const shownKey = shown ? openTabKey(shown) : null;
  const { drawn, sessions, close: closeTab, reorder } = useDrawnTabs(shownKey);
  const order = drawn.map((one) => one.key);
  const dragLabels = useDragLabels();
  const drag = useSortableGroups(
    { [TABS_GROUP]: order },
    () => {},
    (_move, next) => reorder(next[TABS_GROUP] ?? []),
  );

  const close = (key: string) => {
    const next = tabAfterClosing(order, shownKey, key);
    closeTab(key);
    if (next === shownKey) return;
    const tab = next ? openTabOf(next) : null;
    if (!tab) void navigate({ to: '/sessions/new' });
    else if (tab.kind === 'session') {
      void navigate({ to: '/sessions/$sessionId', params: { sessionId: tab.id } });
    } else void navigate({ to: '/sessions/bots/$botId', params: { botId: tab.id } });
  };

  const tabOf = ({ key, tab }: (typeof drawn)[number]) =>
    tab.kind === 'session' ? (
      sessionTab(key, tab.id)
    ) : (
      <Fragment key={key}>
        {bot(tab.id, { active: key === shownKey, onClose: () => close(key) })}
      </Fragment>
    );

  const sessionTab = (key: string, id: string) => {
    if (key === shownKey) {
      return <ShownSessionTab key={key} sessionId={id} onClose={() => close(key)} />;
    }
    const session = sessions?.get(id);
    return session ? (
      <SessionOpenTab key={key} session={session} active={false} onClose={() => close(key)} />
    ) : (
      // The list has not answered yet: the tab holds its place.
      <ChatTabSkeleton key={key} />
    );
  };

  return (
    <ChatTabStrip
      navigation
      label={t('sessions.tabs.label')}
      onNew={shown ? () => void navigate({ to: '/sessions/new' }) : undefined}
      newLabel={t('sessions.tabs.new')}
      reserveNew
    >
      <DragProvider
        {...drag}
        labels={dragLabels}
        overlay={(active) => {
          const one = drawn.find(({ key }) => key === active.id);
          return one ? tabOf(one) : null;
        }}
      >
        {/* The group draws no box: the tabs stay the strip's own children for its spacing and hairlines. */}
        <SortableGroup
          id={TABS_GROUP}
          items={order}
          orientation="horizontal"
          accepts={['chat-tab']}
          className="contents"
        >
          {drawn.map((one) => (
            <SortableChatTab key={one.key} id={one.key}>
              {tabOf(one)}
            </SortableChatTab>
          ))}
        </SortableGroup>
      </DragProvider>
      {shown ? null : (
        <ChatTab active icon={<PlusIcon />} render={<Link to="/sessions/new" search={true} />}>
          {t('sessions.tabs.new')}
        </ChatTab>
      )}
    </ChatTabStrip>
  );
}
