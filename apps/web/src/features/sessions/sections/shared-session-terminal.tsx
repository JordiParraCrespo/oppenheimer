import {
  Button,
  cn,
  EmptyState,
  SegmentedControl,
  SegmentedControlItem,
  Terminal,
  TerminalStatusBar,
  TerminalStatusItem,
} from '@oppenheimer/design-system-web';
import { useSharedSessionStream } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatAvailable, useSessionChat } from '../hooks/use-session-chat';
import { useTerminal } from '../hooks/use-terminal';
import type { SessionView } from '../lib/chat-blocks';
import { SessionChat } from './session-chat';

/**
 * A session's terminal as a guest sees it: the same grid and socket as a
 * member's, with each ticket minted through the share. A `read` share's grid
 * takes no input. No host banner and no files: the host is not the guest's,
 * and nothing they drop would be theirs to send. The status line says the
 * link's state and who shared it, and nothing else. `onEnd` is told when
 * the relay closes the terminal, so the page can ask what the share is now.
 *
 * **Chat** (0.7): once the host sends the agent's transcript, the status bar
 * offers Terminal / Chat as a member's does, and Chat draws over the grid,
 * which stays mounted at its size. Whether the transcript comes is the
 * relay's call, made with the sharer's `session_chat_view` flag, so its
 * arrival is all this asks. A `read` share's chat has no composer; a `write`
 * share's types into the same PTY its grid does.
 */
export function SharedSessionTerminal({
  slug,
  readOnly,
  sharedBy,
  onEnd,
}: {
  slug: string;
  readOnly: boolean;
  sharedBy: string | null;
  onEnd: () => void;
}) {
  const { t } = useTranslation();
  const createStream = useSharedSessionStream(slug);
  const chat = useSessionChat();
  const chatAvailable = useChatAvailable(chat);
  const [view, setView] = useState<SessionView>('terminal');
  const chatShown = chatAvailable && view === 'chat';
  const { containerRef, status, hasOutput, ended, retryNow } = useTerminal(createStream, {
    chat,
    agentWindow: true,
    readOnly,
    onEnd,
  });

  return (
    <Terminal className={cn('min-h-0 flex-1 overflow-hidden', chatShown && 'bg-chat-ground')}>
      <div className="relative min-h-0 flex-1 overflow-hidden px-5 py-4">
        <div ref={containerRef} className="isolate size-full" />
        {status === 'live' && !hasOutput ? (
          <div className="absolute inset-0 flex items-center justify-center bg-term-bg">
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Title>{t('sessions.session.starting.title')}</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
          </div>
        ) : null}
        {chatShown ? (
          <div className="absolute inset-0 bg-chat-ground font-sans text-fg">
            <SessionChat chat={chat} readOnly={readOnly} />
          </div>
        ) : null}
      </div>

      {ended ? (
        <div className="px-5 pb-3">
          <ErrorAlert
            message={t(`sessions.shared.ended.${ended}`)}
            action={
              <Button variant="ghost" size="sm" onClick={retryNow}>
                {t('sessions.session.retry')}
              </Button>
            }
          />
        </div>
      ) : null}

      <TerminalStatusBar>
        {chatAvailable ? (
          <SegmentedControl
            value={view}
            onValueChange={(next) => setView(next === 'chat' ? 'chat' : 'terminal')}
            aria-label={t('sessions.chat.view.label')}
          >
            <SegmentedControlItem value="terminal">
              {t('sessions.chat.view.terminal')}
            </SegmentedControlItem>
            <SegmentedControlItem value="chat">{t('sessions.chat.view.chat')}</SegmentedControlItem>
          </SegmentedControl>
        ) : null}
        <TerminalStatusItem>{t(`sessions.shared.status.${status}`)}</TerminalStatusItem>
        {sharedBy ? (
          <TerminalStatusItem>
            {readOnly
              ? t('sessions.shared.viewOnlyBy', { name: sharedBy })
              : t('sessions.shared.sharedBy', { name: sharedBy })}
          </TerminalStatusItem>
        ) : null}
      </TerminalStatusBar>
    </Terminal>
  );
}
