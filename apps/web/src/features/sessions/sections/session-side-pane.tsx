import { Button, ChatTab, ChatTabStrip, IconButton } from '@oppenheimer/design-system-web';
import { ArrowUpRightIcon, XIcon } from '@oppenheimer/design-system-web/icons';
import {
  useBots,
  useCloseSessionWindow,
  useOpenSessionWindow,
  useSessions,
  useSessionWindows,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import { Link } from '@tanstack/react-router';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSidePane } from '../hooks/use-side-pane';
import type { PreviewTab } from '../lib/preview-open';
import {
  type SideEngine,
  type SideItem,
  shownTab,
  sideItemKey,
  windowAgent,
} from '../lib/side-pane';
import { SessionBrowser } from './session-browser';
import { SessionDesktop } from './session-desktop';
import { SessionDevice } from './session-device';
import { SidePaneLauncher } from './side-pane-launcher';
import { SideTerminal } from './side-terminal';

/**
 * The side pane beside a session: a tab for each thing opened beside it, and
 * the launcher when none is shown (`product/design/console/32-side-pane.md`).
 * A terminal is one of the session's windows past the agent's, listed by its
 * host, so its tabs follow the host: one opened on another device shows here
 * too, and closing its tab closes the window. It runs a plain shell, or a
 * second agent in the same worktree, named after it. Another session, a
 * bot's chat and the
 * previews are what this device chose to keep beside this session.
 *
 * Another session and a bot's chat are drawn by the screen around this pane
 * (`session`, `bot`): the first is this feature's own pane, which cannot be
 * imported back into itself, the second the bots feature's.
 */
export function SessionSidePane({
  sessionId,
  sessionEngine,
  hostId,
  previews,
  onClose,
  session,
  bot,
}: {
  sessionId: string;
  /** The session's own agent and launch, which the Agent pick opens on. */
  sessionEngine: ComponentProps<typeof SidePaneLauncher>['session'];
  hostId: string | null;
  /** The previews this console and deployment can show. */
  previews: readonly PreviewTab[];
  onClose: () => void;
  session: (sessionId: string) => ReactNode;
  bot?: (botId: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const side = useSidePane(sessionId);
  // A session a host started has shells beside its agent; a cloud one has none.
  const windows = useSessionWindows(hostId !== null ? sessionId : undefined);
  const openWindow = useOpenSessionWindow();
  const closeWindow = useCloseSessionWindow();
  const { data: sessionNames } = useSessions({
    select: (sessions) => new Map(sessions.map((one) => [one.id, one.name])),
  });
  const { data: botNames } = useBots({
    select: (bots) => new Map(bots.map((one) => [one.id, one.name])),
  });

  const shells = (windows.data?.windows ?? []).filter((window) => !window.agent);
  const terminalItems: SideItem[] = shells.map((window) => ({
    kind: 'terminal',
    window: window.index,
  }));
  const agentIn = (index: number) => {
    const name = shells.find((window) => window.index === index)?.name;
    return name ? windowAgent(name) : null;
  };
  // A preview this console no longer offers, or a bot with no chat to draw it,
  // stays kept on the device and is left off the strip.
  const kept = side.kept.items.filter((item) =>
    item.kind === 'bot'
      ? Boolean(bot)
      : item.kind === 'preview'
        ? previews.includes(item.tab)
        : true,
  );
  const items: SideItem[] = [...terminalItems, ...kept];
  const order = items.map(sideItemKey);
  const active = shownTab(order, side.kept.active);
  const shown = items.find((item) => sideItemKey(item) === active);

  const title = (item: SideItem) => {
    switch (item.kind) {
      case 'terminal': {
        const agent = agentIn(item.window);
        return agent
          ? t('sessions.side.agent.name', { agent: CODING_AGENTS[agent].label, index: item.window })
          : t('sessions.side.terminal.name', { index: item.window });
      }
      case 'session':
        return sessionNames?.get(item.sessionId) ?? t('sessions.side.launcher.session');
      case 'bot':
        return botNames?.get(item.botId) ?? t('sessions.side.launcher.bot');
      case 'preview':
        return t(`sessions.preview.${item.tab}`);
    }
  };
  const close = (item: SideItem) => {
    const key = sideItemKey(item);
    if (item.kind === 'terminal') closeWindow.mutate({ sessionId, window: item.window });
    side.close(key, order);
  };
  const opened = {
    onSuccess: (window: { window: { index: number } }) =>
      side.show(`terminal:${window.window.index}`),
  };
  const newTerminal = () => openWindow.mutate({ sessionId }, opened);
  const startAgent = (engine: SideEngine) =>
    openWindow.mutate(
      {
        sessionId,
        agent: engine.agent,
        ...(engine.model ? { model: engine.model } : {}),
        ...(engine.effort ? { effort: engine.effort } : {}),
        ...(engine.permission ? { permission: engine.permission } : {}),
        ...(engine.prompt ? { prompt: engine.prompt } : {}),
      },
      opened,
    );
  const opening = openWindow.isPending ? (openWindow.variables?.agent ?? 'shell') : null;

  return (
    <aside
      aria-label={t('sessions.side.label')}
      className="flex w-110 min-w-90 shrink-0 flex-col border-l border-border-subtle bg-card"
    >
      <header className="flex min-h-11.5 items-center gap-1 border-b border-border-subtle px-2">
        <ChatTabStrip
          className="min-w-0 flex-1 bg-transparent"
          onNew={() => side.show(null)}
          newLabel={t('sessions.side.new')}
        >
          {items.map((item) => (
            <ChatTab
              key={sideItemKey(item)}
              active={sideItemKey(item) === active}
              onClick={() => side.show(sideItemKey(item))}
              onClose={() => close(item)}
              closeLabel={t('sessions.side.closeTab', { name: title(item) })}
            >
              {title(item)}
            </ChatTab>
          ))}
        </ChatTabStrip>
        {shown?.kind === 'session' ? (
          <IconButton
            size="sm"
            aria-label={t('sessions.side.openFull')}
            render={<Link to="/sessions/$sessionId" params={{ sessionId: shown.sessionId }} />}
          >
            <ArrowUpRightIcon />
          </IconButton>
        ) : null}
        {shown?.kind === 'bot' ? (
          <IconButton
            size="sm"
            aria-label={t('sessions.side.openFull')}
            render={<Link to="/bots/$botId" params={{ botId: shown.botId }} />}
          >
            <ArrowUpRightIcon />
          </IconButton>
        ) : null}
        <IconButton size="sm" aria-label={t('sessions.side.close')} onClick={onClose}>
          <XIcon />
        </IconButton>
      </header>
      {/* The shells could not be listed: said here, with a way to ask again,
          rather than Terminal quietly leaving the launcher. */}
      <ErrorAlert
        error={windows.error}
        fallback={t('sessions.side.terminal.loadFailed')}
        action={
          <Button variant="ghost" size="sm" onClick={() => windows.refetch()}>
            {t('common.retry')}
          </Button>
        }
        className="m-3"
      />
      <ErrorAlert
        error={openWindow.error}
        fallback={
          openWindow.variables?.agent
            ? t('sessions.side.agent.openFailed')
            : t('sessions.side.terminal.openFailed')
        }
        onDismiss={() => openWindow.reset()}
        className="m-3"
      />
      <ErrorAlert
        error={closeWindow.error}
        fallback={t('sessions.side.terminal.closeFailed')}
        onDismiss={() => closeWindow.reset()}
        className="m-3"
      />
      {shown === undefined ? (
        <SidePaneLauncher
          sessionId={sessionId}
          session={sessionEngine}
          previews={previews}
          terminals={windows.data?.state === 'listed'}
          bots={Boolean(bot)}
          onOpen={side.open}
          onNewTerminal={newTerminal}
          onStartAgent={startAgent}
          opening={opening}
        />
      ) : null}
      {shown?.kind === 'terminal' && hostId ? (
        <SideTerminal
          key={shown.window}
          sessionId={sessionId}
          hostId={hostId}
          window={shown.window}
        />
      ) : null}
      {shown?.kind === 'session' ? (
        <div key={shown.sessionId} className="flex min-h-0 flex-1 flex-col">
          {session(shown.sessionId)}
        </div>
      ) : null}
      {shown?.kind === 'bot' && bot ? (
        <div key={shown.botId} className="flex min-h-0 flex-1 flex-col">
          {bot(shown.botId)}
        </div>
      ) : null}
      {shown?.kind === 'preview' && shown.tab === 'browser' ? (
        <SessionBrowser sessionId={sessionId} />
      ) : null}
      {shown?.kind === 'preview' && shown.tab === 'simulator' ? (
        <SessionDevice sessionId={sessionId} />
      ) : null}
      {shown?.kind === 'preview' && shown.tab === 'desktop' && hostId !== null ? (
        <SessionDesktop hostId={hostId} />
      ) : null}
    </aside>
  );
}
