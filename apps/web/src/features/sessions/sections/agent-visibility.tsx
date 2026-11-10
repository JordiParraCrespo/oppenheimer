import { AgentMark, SettingsGroup, SettingsRow, Switch } from '@oppenheimer/design-system-web';
import { useStoredList } from '@oppenheimer/frontend-web';
import { CODING_AGENT_IDS, CODING_AGENTS } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { HIDDEN_AGENTS_KEY, shownAgents, withAgentShown } from '../lib/hidden-agents';

/**
 * One switch per agent the catalog has: whether New session's engine picker
 * offers it on this device. A switch applies the moment it flips, as the
 * picker's stars do. The last agent shown cannot be switched off, so the
 * picker always has one to offer.
 */
export function AgentVisibility() {
  const { t } = useTranslation();
  const [hidden, setHidden] = useStoredList(HIDDEN_AGENTS_KEY);
  const shown = shownAgents(hidden);

  return (
    <SettingsGroup>
      {CODING_AGENT_IDS.map((id) => {
        const visible = shown.includes(id);
        const label = CODING_AGENTS[id].label;
        return (
          <SettingsRow
            key={id}
            label={
              <span className="flex items-center gap-2">
                <AgentMark agent={id} />
                {label}
              </span>
            }
            hint={visible && shown.length === 1 ? t('settings.agents.lastShown') : undefined}
          >
            <Switch
              checked={visible}
              disabled={visible && shown.length === 1}
              onCheckedChange={(next) => setHidden(withAgentShown(hidden, id, next))}
              aria-label={t('settings.agents.show', { agent: label })}
            />
          </SettingsRow>
        );
      })}
    </SettingsGroup>
  );
}
