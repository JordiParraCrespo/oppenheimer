import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { AgentReportWord } from '../lib/session-run-state';

/** The agent's word and message as one line: "Needs your permission · approve Bash: pnpm test". */
export function agentReportText(
  t: TFunction,
  word: AgentReportWord | null,
  message: string | null,
): string {
  const phrase = word ? t(`sessions.session.agentReport.${word}`) : null;
  return [phrase, message].filter(Boolean).join(' · ');
}

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
  return (
    <span className="min-w-0 max-w-96 truncate text-xs text-fg-subtle" title={message ?? undefined}>
      {agentReportText(t, word, message)}
    </span>
  );
}
