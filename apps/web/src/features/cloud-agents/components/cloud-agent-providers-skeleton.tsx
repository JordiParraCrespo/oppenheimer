import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import {
  CLOUD_AGENT_PROVIDER_LABELS,
  CLOUD_AGENT_PROVIDERS,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { useTranslation } from 'react-i18next';

/**
 * Cloud agent providers before the status answers. The providers are known,
 * so each name and what it serves is written; whose key it is and the
 * row's button are bars on the row's own frame.
 */
export function CloudAgentProvidersSkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      {CLOUD_AGENT_PROVIDERS.map((provider) => (
        <SettingsListRow
          key={provider}
          align="center"
          aria-hidden
          kind={<Skeleton shape="sm" className="h-2 w-24" />}
          meta={t(`settings.cloudAgents.providers.${provider}`)}
          actions={<Skeleton shape="pill" className="h-7 w-18" />}
        >
          {CLOUD_AGENT_PROVIDER_LABELS[provider]}
        </SettingsListRow>
      ))}
      <LoadingStatus />
    </SettingsGroup>
  );
}
