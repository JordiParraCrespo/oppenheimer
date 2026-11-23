import { AgentMark, SettingsGroup, SettingsRow, Switch } from '@oppenheimer/design-system-web';
import { useStoredList } from '@oppenheimer/frontend-web';
import { CODING_AGENTS, isCodingAgentId } from '@oppenheimer/shared/agents';
import { CLOUD_AGENT_LABELS } from '@oppenheimer/shared/schemas/cloud-agent';
import { useTranslation } from 'react-i18next';
import {
  AGENT_CHOICES_KEY,
  CHOOSABLE_AGENT_IDS,
  isAgentShown,
  shownAgents,
  withAgentShown,
} from '../lib/agent-choices';

/**
 * One switch per agent New session's engine picker can offer on this device:
 * the catalog's, then a vendor's cloud agent (Cursor), which the picker shows
 * once its key is saved. A switch applies the moment it flips, as the
 * picker's stars do. The last host agent shown cannot be switched off, so the
 * picker always has one to offer.
 */
export function AgentVisibility() {
  const { t } = useTranslation();
  const [choices, setChoices] = useStoredList(AGENT_CHOICES_KEY);
  const hostShown = shownAgents(choices);

  return (
    <SettingsGroup>
      {CHOOSABLE_AGENT_IDS.map((id) => {
        const visible = isAgentShown(choices, id);
        const last = visible && isCodingAgentId(id) && hostShown.length === 1;
        const label = isCodingAgentId(id) ? CODING_AGENTS[id].label : CLOUD_AGENT_LABELS[id];
        return (
          <SettingsRow
            key={id}
            label={
              <span className="flex items-center gap-2">
                <AgentMark agent={id} />
                {label}
              </span>
            }
            hint={last ? t('settings.agents.lastShown') : undefined}
          >
            <Switch
              checked={visible}
              disabled={last}
              onCheckedChange={(next) => setChoices(withAgentShown(choices, id, next))}
              aria-label={t('settings.agents.show', { agent: label })}
            />
          </SettingsRow>
        );
      })}
    </SettingsGroup>
  );
}
