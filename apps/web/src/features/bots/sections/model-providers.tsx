import { Button, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import {
  useRemoveModelProviderKey,
  useSuspenseModelProviders,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatgptLoginDialog } from '../dialogs/chatgpt-login';
import { ModelProviderKeyDialog } from '../dialogs/model-provider-key';

/**
 * The providers, one row each: what it serves, whether the workspace has a
 * key (its last four characters), and Add key or Replace and Remove. The key
 * is typed in a dialog and never comes back. ChatGPT takes no key: its row
 * signs in to a ChatGPT subscription (Connect ChatGPT, Sign in again,
 * Disconnect), and says which account by its last characters. Read under
 * Suspense, in the screen's `QueryState`. A server with no sealing key can
 * store none, so the buttons are drawn disabled, the screen's warning as
 * their reason.
 */
export function ModelProviders() {
  const { t } = useTranslation();
  const { data: providers, error } = useSuspenseModelProviders();
  const { data: deployment } = useDeploymentCapabilities();
  const [editing, setEditing] = useState<BotProvider | null>(null);
  const remove = useRemoveModelProviderKey();
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
      <SettingsGroup>
        {providers.map((row) => {
          const { label, auth } = BOT_PROVIDER_CATALOG[row.provider];
          const signIn = auth === 'sign_in';
          return (
            <SettingsListRow
              key={row.provider}
              align="center"
              data-testid="model-provider"
              meta={t(`settings.modelProviders.providers.${row.provider}`)}
              kind={
                row.configured && row.keyHint
                  ? t(
                      signIn
                        ? 'settings.modelProviders.signedIn'
                        : 'settings.modelProviders.keyEnding',
                      { hint: row.keyHint },
                    )
                  : t(
                      signIn
                        ? 'settings.modelProviders.notConnected'
                        : 'settings.modelProviders.noKey',
                    )
              }
              actions={
                <>
                  {row.configured ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t(
                        signIn
                          ? 'settings.modelProviders.disconnectLabel'
                          : 'settings.modelProviders.removeLabel',
                        { provider: label },
                      )}
                      pending={remove.isPending && remove.variables === row.provider}
                      disabled={unavailable}
                      title={unavailableReason}
                      onClick={() => remove.mutate(row.provider)}
                    >
                      {t(
                        signIn
                          ? 'settings.modelProviders.disconnect'
                          : 'settings.modelProviders.remove',
                      )}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={unavailable}
                    title={unavailableReason}
                    onClick={() => setEditing(row.provider)}
                  >
                    {t(
                      signIn
                        ? row.configured
                          ? 'settings.modelProviders.reconnect'
                          : 'settings.modelProviders.connect'
                        : row.configured
                          ? 'settings.modelProviders.replace'
                          : 'settings.modelProviders.add',
                    )}
                  </Button>
                </>
              }
            >
              {label}
            </SettingsListRow>
          );
        })}
      </SettingsGroup>
      {editing === 'chatgpt' ? (
        <ChatgptLoginDialog onClose={() => setEditing(null)} />
      ) : editing ? (
        <ModelProviderKeyDialog provider={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
