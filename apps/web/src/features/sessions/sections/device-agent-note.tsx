import { useSuspenseSession } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { agentReportText } from '../components/agent-report-note';
import { agentNoteFor } from '../lib/session-run-state';

/**
 * What the session's agent last said it is doing (OSC 7501), on the phone's
 * screen while it has no picture: "Checking iOS build progress" says why the
 * screen is still black better than a spinner does. Nothing when the agent
 * has said nothing. The session is the one the screen around the pane has
 * already read, so this subscribes to its cache and never suspends.
 */
export function DeviceAgentNote({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();
  // A refetch that fails is not drawn here: the session's bar says it, and this line keeps the last note.
  const { data: session } = useSuspenseSession(sessionId);
  const note = agentNoteFor(session);
  if (!note) return null;
  const text = agentReportText(t, note.word, note.message);
  return (
    <p
      className="line-clamp-2 text-xs text-device-screen-fg-muted"
      title={note.message ?? undefined}
    >
      {t('sessions.preview.agentDoing', { note: text })}
    </p>
  );
}
