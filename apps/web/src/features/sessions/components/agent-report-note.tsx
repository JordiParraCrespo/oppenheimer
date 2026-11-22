import { useTranslation } from 'react-i18next';
import type { AgentReportWord } from '../lib/session-run-state';

/**
 * The agent's own word after the session's state: why it waits ("Needs your
 * permission") and what it says ("approve Bash: pnpm test"), as it reported
 * them through OSC 7501. The message is the agent's, so it is shown as it
 * came, cut to one line with the whole of it on hover.
 */
export function AgentReportNote({
  word,
  message,
}: {
  word: AgentReportWord | null;
  message: string | null;
}) {
  const { t } = useTranslation();
  const phrase = word ? t(`sessions.session.agentReport.${word}`) : null;
  const text = [phrase, message].filter(Boolean).join(' · ');
  return (
    <span className="min-w-0 max-w-96 truncate text-xs text-fg-subtle" title={message ?? undefined}>
      {text}
    </span>
  );
}
