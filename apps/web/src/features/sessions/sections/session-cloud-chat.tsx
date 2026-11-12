import { StatusDot } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { ErrorAlert, PageFrame } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { useCloudSessionChat } from '../hooks/use-cloud-session-chat';
import { useChatTurnIds } from '../hooks/use-session-chat';
import { dotFor, stateWordFor } from '../lib/session-run-state';
import { SessionChat } from './session-chat';
import { SessionCloudChatSetup } from './session-cloud-chat-setup';
import { SessionCloudSummary } from './session-cloud-summary';

/**
 * A Claude Code cloud session read as a chat
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session"): its
 * transcript as its SessionStart hook sends it, drawn by the chat a host
 * session uses, and a composer whose message waits for the session's Stop
 * hook, which hands it to the agent when its turn ends, or is sent from a
 * host signed in to the session's claude.ai account when no hook takes it,
 * which wakes an idle session; such a reply reads as sent until the
 * transcript shows it. Until a line has
 * come (no hooks in the repository, or nothing said yet) it is the cloud
 * session's own pane, which says where to follow it instead, with how to
 * turn the chat on under it.
 */
export function SessionCloudChat({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const { chat, pending, failure, dismissFailure } = useCloudSessionChat(session.id);
  const turns = useChatTurnIds(chat);
  const waiting = pending.filter((reply) => reply.state === 'waiting').length;
  const sent = pending.length - waiting;

  if (turns.length === 0 && pending.length === 0) {
    return (
      <PageFrame size="status">
        <SessionCloudSummary session={session} />
        <SessionCloudChatSetup organizationId={session.organizationId} />
      </PageFrame>
    );
  }

  // On the chat's ground, as a host session's chat is (`session-pane.tsx`):
  // the fade over the transcript while the reader is away from its end is
  // painted in that colour, and on the pane's grey it drew a lighter band
  // with a hard edge over the composer.
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-chat-ground">
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
        {waiting > 0 ? (
          <span className="text-fg-subtle">
            {t('sessions.cloudChat.waiting', { count: waiting })}
          </span>
        ) : null}
        {sent > 0 ? (
          <span className="text-fg-subtle">{t('sessions.cloudChat.sent', { count: sent })}</span>
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
    </div>
  );
}
