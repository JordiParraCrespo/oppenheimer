import { AgentModelSelect, type AgentOption, type Engine } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The engine button of the composer's foot row: the agent, then its model.
 *
 * Harness first and models second, because the pair has to be valid and only
 * the second pane can guarantee it (`product/versions/mvp/05-screens.md`). An
 * agent the catalog lists no models for is picked outright and the button
 * names the agent — which is codex today, until a probe reports what a given
 * machine's CLI actually offers.
 *
 * The agent list is the shared catalog's, mapped in `lib/session-options.ts`.
 * Whether *this host* has that agent on `PATH` is a host fact and a hint, never
 * a gate, so nothing here disables a row.
 */
export function AgentSelect({
  agents,
  value,
  onValueChange,
  disabled,
}: {
  agents: AgentOption[];
  value: Engine;
  onValueChange: (value: Engine) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <AgentModelSelect
      agents={agents}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      aria-label={t('sessions.new.agent.label')}
    />
  );
}
