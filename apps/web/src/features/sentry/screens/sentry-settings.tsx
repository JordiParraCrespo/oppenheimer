import { SettingsTitle } from '@oppenheimer/design-system-web';
import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { SentryConnectionSkeleton } from '../components/sentry-connection-skeleton';
import { SentryConnectionSection } from '../sections/sentry-connection';

/**
 * Settings → Sentry (`product/next-steps/sentry.md`): the workspace's Sentry
 * organization, connected through an internal integration whose webhooks
 * start the automations with a Sentry trigger.
 */
export function SentrySettingsScreen() {
  const { t } = useTranslation();
  return (
    <>
      <SettingsTitle
        title={t('settings.sentry.title')}
        description={t('settings.sentry.description')}
      />
      <QueryState>
        <QueryState.Pending>
          <SentryConnectionSkeleton />
        </QueryState.Pending>
        <QueryState.Error fallback={t('settings.sentry.loadFailed')} />
        <QueryState.Data>
          <SentryConnectionSection />
        </QueryState.Data>
      </QueryState>
    </>
  );
}
