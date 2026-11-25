import { AgentMark, ChatTab } from '@oppenheimer/design-system-web';
import { type SessionEntity, stateWordFor } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useSessionUnread } from '../hooks/use-session-unread';
import { agentNoteFor, isWorking, rowAttentionFor } from '../lib/session-run-state';

/** The dot's accessible name, the same words the sidebar row's dot reads. */
const ATTENTION_LABEL = {
  'needs-you': 'sessions.filters.statuses.needs-you',
  done: 'sessions.filters.statuses.done',
  unread: 'sessions.sidebar.unreadLabel',
} as const;

/**
 * A session open as a tab over Sessions: its agent's mark, its name and its
 * close, with the dot its sidebar row draws (amber while it waits on you,
 * blue once it is ready or marked unread) and the row's shimmer while its
 * agent works. The bar has one line, so where it runs and its state are the
 * tab's tooltip: the branch or the folder, the state word, and what the
 * agent itself said it waits on.
 */
export function SessionOpenTab({
  session,
  active,
  onClose,
}: {
  session: SessionEntity;
  active: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const unread = useSessionUnread(session.id);
  const attention = rowAttentionFor(session, unread.unread);
  const note = agentNoteFor(session);
  const where = session.cwdCheckout?.branch ?? session.folderPath;
  const state = [
    t(`sessions.session.state.${stateWordFor(session)}`),
    note?.word ? t(`sessions.session.agentReport.${note.word}`) : null,
    note?.message ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ChatTab
      active={active}
      icon={<AgentMark agent={session.agent} />}
      attention={attention}
      attentionLabel={attention ? t(ATTENTION_LABEL[attention]) : undefined}
      working={isWorking(session)}
      title={[session.name, where, state].filter(Boolean).join('\n')}
      render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
      onClose={onClose}
      closeLabel={t('sessions.tabs.close', { name: session.name })}
    >
      {session.name}
    </ChatTab>
  );
}
