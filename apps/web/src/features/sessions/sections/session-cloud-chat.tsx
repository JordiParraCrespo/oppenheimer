import { StatusDot } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useCloudSessionChat } from '../hooks/use-cloud-session-chat';
import { useChatTurnIds } from '../hooks/use-session-chat';
import { dotFor, stateWordFor } from '../lib/session-run-state';
import { SessionChat } from './session-chat';
import { SessionCloud } from './session-cloud';

/**
 * A Claude Code cloud session read as a chat
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session"): its
 * transcript as its SessionStart hook sends it, drawn by the chat a host
 * session uses, and a composer whose message waits for the session's Stop
 * hook, which hands it to the agent when its turn ends. Until a line has
 * come (no hooks in the repository, or nothing said yet) it is the cloud
 * session's own pane, which says where to follow it instead.
 */
export function SessionCloudChat({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const { chat, waiting, failure, dismissFailure } = useCloudSessionChat(session.id);
  const turns = useChatTurnIds(chat);

  if (turns.length === 0 && waiting.length === 0) return <SessionCloud session={session} />;

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 text-sm text-fg-muted">
        <StatusDot state={dotFor(session)}>
          {t(`sessions.session.state.${stateWordFor(session)}`)}
        </StatusDot>
        <span>{t('sessions.cloudChat.title')}</span>
        {session.cloudUrl ? (
          <a className="text-link" href={session.cloudUrl} target="_blank" rel="noreferrer">
            {t('sessions.cloud.open')}
          </a>
        ) : null}
        {waiting.length > 0 ? (
          <span className="text-fg-subtle">
            {t('sessions.cloudChat.waiting', { count: waiting.length })}
          </span>
        ) : null}
      </div>
      {failure ? (
        <ErrorAlert
          error={failure}
          fallback={t('sessions.cloudChat.replyFailed')}
          onDismiss={dismissFailure}
        />
      ) : null}
      <SessionChat chat={chat} agent="claude-code" readOnly={false} />
    </>
  );
}
