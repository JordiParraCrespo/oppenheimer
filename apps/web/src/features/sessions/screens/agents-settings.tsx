import { SettingsTitle } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { AgentVisibility } from '../sections/agent-visibility';

/** Settings → Agents: which agents New session's engine picker offers on this device. */
export function AgentsSettingsScreen() {
  const { t } = useTranslation();

  return (
    <>
      <SettingsTitle title={t('settings.agents.title')} description={t('settings.agents.hint')} />
      <AgentVisibility />
    </>
  );
}
