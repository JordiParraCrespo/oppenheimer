import {
  Button,
  cn,
  EmptyState,
  Terminal,
  TerminalStatusBar,
  TerminalStatusItem,
} from '@oppenheimer/design-system-web';
import { useSharedSessionStream } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ChatCover } from '../components/chat-cover';
import { ChatViewToggle } from '../components/chat-view-toggle';
import { useChatReading } from '../hooks/use-session-chat';
import { useTerminal } from '../hooks/use-terminal';
import type { PaneReading } from '../lib/chat-blocks';

/**
 * A session's terminal as a guest sees it: the same grid and socket as a
 * member's, with each ticket minted through the share. A `read` share's grid
 * takes no input. No host banner and no files: the host is not the guest's,
 * and nothing they drop would be theirs to send. The status line says the
 * link's state and who shared it, and nothing else. `onEnd` is told when
 * the relay closes the terminal, so the page can ask what the share is now.
 *
 * **Chat** (0.7): as `SessionTerminal`, the pane hands in its `reading`;
 * this stream feeds the chat and lends it its input, and once the transcript
 * arrives the status bar offers Terminal / Chat and Chat draws the pane's
 * `cover` over the grid. The relay sends the transcript only when the sharer
 * has `session_chat_view`.
 */
export function SharedSessionTerminal({
  slug,
  readOnly,
  sharedBy,
  onEnd,
  reading,
}: {
  slug: string;
  /** The chat this terminal feeds, and how the pane around it reads it. */
  reading: PaneReading;
  readOnly: boolean;
  sharedBy: string | null;
  onEnd: () => void;
}) {
  const { t } = useTranslation();
  const createStream = useSharedSessionStream(slug);
  const { chat, view, onViewChange, cover } = reading;
  const { offered: chatOffered, shown: chatShown } = useChatReading(reading);
  const { containerRef, status, hasOutput, ended, retryNow } = useTerminal(createStream, {
    chat,
    agentWindow: true,
    readOnly,
    onEnd,
  });

  return (
    <Terminal className={cn('min-h-0 flex-1 overflow-hidden', chatShown && 'bg-transparent')}>
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
        {chatShown ? <ChatCover>{cover}</ChatCover> : null}
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
        {chatOffered ? <ChatViewToggle view={view} onViewChange={onViewChange} /> : null}
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
