import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { BOT_PROVIDER_CATALOG, BOT_PROVIDERS } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * Model providers before the workspace's keys answer. The API lists every
 * provider in catalog order, so the rows are known: each name and what it
 * serves written, the key's tag and the row's buttons as bars on the row's
 * own frame, since only the read says whether there is a key.
 */
export function ModelProvidersSkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      {BOT_PROVIDERS.map((provider) => (
        <SettingsListRow
          key={provider}
          align="center"
          aria-hidden
          kind={<Skeleton shape="sm" className="h-2 w-16" />}
          meta={t(`settings.modelProviders.providers.${provider}`)}
          actions={<Skeleton shape="pill" className="h-7 w-18" />}
        >
          {BOT_PROVIDER_CATALOG[provider].label}
        </SettingsListRow>
      ))}
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
    </SettingsGroup>
  );
}
