import { AgentModelSelect, type AgentOption, type Engine } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * The composer's engine button: the agent, then its model. Harness first,
 * because only the second pane can guarantee a valid pair
 * (`product/versions/mvp/05-screens.md`); an agent with no listed models, the
 * plain terminal, is picked outright. The list is the shared catalog's
 * (`lib/session-options.ts`). Whether this host has the agent on `PATH` is a
 * hint, never a gate, so no row is disabled.
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
      searchPlaceholder={t('sessions.new.agent.search')}
      emptyText={(query) => t('sessions.new.agent.empty', { query })}
    />
  );
}
