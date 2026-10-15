import { Button, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import {
  useRemoveModelProviderKey,
  useSetDefaultModelProvider,
  useSuspenseModelProviders,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModelProviderKeyDialog } from '../dialogs/model-provider-key';

/**
 * The providers, one row each: what it serves, whether the workspace has a
 * key (its last four characters), and Add key or Replace and Remove. The one
 * new bots start on says Default; another with a key offers Make default. The
 * key is typed in a dialog and never comes back. Read under Suspense, in the
 * screen's `QueryState`. A server with no sealing key can store none, so the
 * three are drawn disabled, the screen's warning as their reason.
 */
export function ModelProviders() {
  const { t } = useTranslation();
  const { data: providers, error } = useSuspenseModelProviders();
  const { data: deployment } = useDeploymentCapabilities();
  const [editing, setEditing] = useState<BotProvider | null>(null);
  const remove = useRemoveModelProviderKey();
  const makeDefault = useSetDefaultModelProvider();
  const unavailable = deployment !== undefined && !deployment.bot_providers;
  const unavailableReason = unavailable ? t('settings.modelProviders.unavailable') : undefined;

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.modelProviders.loadFailed')} />
      <ErrorAlert
        error={remove.error}
        fallback={t('settings.modelProviders.removeFailed')}
        onDismiss={() => remove.reset()}
      />
      <ErrorAlert
        error={makeDefault.error}
        fallback={t('settings.modelProviders.makeDefaultFailed')}
        onDismiss={() => makeDefault.reset()}
      />
      <SettingsGroup>
        {providers.map((row) => {
          const label = BOT_PROVIDER_CATALOG[row.provider].label;
          return (
            <SettingsListRow
              key={row.provider}
              align="center"
              data-testid="model-provider"
              meta={t(`settings.modelProviders.providers.${row.provider}`)}
              kind={
                row.configured && row.keyHint
                  ? t('settings.modelProviders.keyEnding', { hint: row.keyHint })
                  : t('settings.modelProviders.noKey')
              }
              actions={
                <>
                  {row.isDefault ? (
                    t('settings.modelProviders.default')
                  ) : row.configured ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('settings.modelProviders.makeDefaultLabel', {
                        provider: label,
                      })}
                      pending={makeDefault.isPending && makeDefault.variables === row.provider}
                      disabled={makeDefault.isPending}
                      onClick={() => makeDefault.mutate(row.provider)}
                    >
                      {t('settings.modelProviders.makeDefault')}
                    </Button>
                  ) : null}
                  {row.configured ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('settings.modelProviders.removeLabel', { provider: label })}
                      pending={remove.isPending && remove.variables === row.provider}
                      disabled={unavailable}
                      title={unavailableReason}
                      onClick={() => remove.mutate(row.provider)}
                    >
                      {t('settings.modelProviders.remove')}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={unavailable}
                    title={unavailableReason}
                    onClick={() => setEditing(row.provider)}
                  >
                    {row.configured
                      ? t('settings.modelProviders.replace')
                      : t('settings.modelProviders.add')}
                  </Button>
                </>
              }
            >
              {label}
            </SettingsListRow>
          );
        })}
      </SettingsGroup>
      {editing ? (
        <ModelProviderKeyDialog provider={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
