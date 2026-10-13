import {
  Button,
  EmptyState,
  Terminal,
  TerminalStatusBar,
  TerminalStatusItem,
} from '@oppenheimer/design-system-web';
import { useSharedSessionStream } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useTerminal } from '../hooks/use-terminal';

/**
 * A session's terminal as a guest sees it: the same grid and socket as a
 * member's, with each ticket minted through the share. A `read` share's grid
 * takes no input. No host banner and no files: the host is not the guest's,
 * and nothing they drop would be theirs to send. The status line says the
 * link's state and who shared it, and nothing else.
 */
export function SharedSessionTerminal({
  slug,
  readOnly,
  sharedBy,
}: {
  slug: string;
  readOnly: boolean;
  sharedBy: string | null;
}) {
  const { t } = useTranslation();
  const createStream = useSharedSessionStream(slug);
  const { containerRef, status, hasOutput, ended, retryNow } = useTerminal(createStream, {
    agentWindow: true,
    readOnly,
  });

  return (
    <Terminal className="min-h-0 flex-1 overflow-hidden">
      <div className="relative min-h-0 flex-1 overflow-hidden px-5 py-4">
        <div ref={containerRef} className="size-full" />
        {status === 'live' && !hasOutput ? (
          <div className="absolute inset-0 flex items-center justify-center bg-term-bg">
            <EmptyState>
              <EmptyState.Header>
                <EmptyState.Title>{t('sessions.session.starting.title')}</EmptyState.Title>
              </EmptyState.Header>
            </EmptyState>
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
