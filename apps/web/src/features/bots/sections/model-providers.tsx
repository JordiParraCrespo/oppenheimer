import { SettingsGroup, SettingsHeading, SettingsListRow } from '@oppenheimer/design-system-web';
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
import { ModelProviderActions } from '../components/model-provider-actions';
import { ModelProviderName } from '../components/model-provider-name';
import { ModelProviderStatus } from '../components/model-provider-status';
import { ChatgptLoginDialog } from '../dialogs/chatgpt-login';
import { ModelProviderKeyDialog } from '../dialogs/model-provider-key';
import { groupModelProviders } from '../lib/model-provider-groups';

/**
 * The providers, in two cards: Connected (a key or a sign-in) above, Not
 * connected below, each headed by how many it holds and in catalog order
 * within; a card with none is left out. One row each: the provider's mark and
 * name, what it serves, the key's last four characters behind a green check,
 * and Add key or Replace and Remove. The one new bots start on carries a
 * Default badge; another with a key offers Make default. The
 * key is typed in a dialog and never comes back. ChatGPT takes no key: its row
 * signs in to a ChatGPT subscription (Connect ChatGPT, Sign in again,
 * Disconnect), and says which account by its last characters. Read under
 * Suspense, in the screen's `QueryState`. A server with no sealing key can
 * store none, so the key and sign-in buttons are drawn disabled, the screen's
 * warning as their reason.
 */
export function ModelProviders() {
  const { t } = useTranslation();
  const { data: providers, error } = useSuspenseModelProviders();
  const { data: deployment } = useDeploymentCapabilities();
  const [editing, setEditing] = useState<BotProvider | null>(null);
  const remove = useRemoveModelProviderKey();
  const makeDefault = useSetDefaultModelProvider();
  const groups = groupModelProviders(providers);
  const unavailableReason =
    deployment !== undefined && !deployment.bot_providers
      ? t('settings.modelProviders.unavailable')
      : undefined;

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
      {groups.map(({ id, rows }) => (
        <section
          key={id}
          aria-labelledby={`model-providers-${id}`}
          className="flex flex-col gap-2.5"
        >
          <SettingsHeading id={`model-providers-${id}`}>
            {t(`settings.modelProviders.groups.${id}`)}
            <span className="ml-2 font-normal text-fg-subtle">{rows.length}</span>
          </SettingsHeading>
          <SettingsGroup>
            {rows.map((row) => {
              const { label, auth } = BOT_PROVIDER_CATALOG[row.provider];
              const signIn = auth === 'sign_in';
              return (
                <SettingsListRow
                  key={row.provider}
                  align="center"
                  data-testid="model-provider"
                  meta={t(`settings.modelProviders.providers.${row.provider}`)}
                  kind={
                    <ModelProviderStatus
                      signIn={signIn}
                      hint={row.configured ? row.keyHint : null}
                    />
                  }
                  actions={
                    <ModelProviderActions
                      label={label}
                      signIn={signIn}
                      configured={row.configured}
                      isDefault={row.isDefault}
                      unavailableReason={unavailableReason}
                      makingDefault={
                        makeDefault.isPending && makeDefault.variables === row.provider
                      }
                      defaultBusy={makeDefault.isPending}
                      removing={remove.isPending && remove.variables === row.provider}
                      onMakeDefault={() => makeDefault.mutate(row.provider)}
                      onRemove={() => remove.mutate(row.provider)}
                      onEdit={() => setEditing(row.provider)}
                    />
                  }
                >
                  <ModelProviderName provider={row.provider} isDefault={row.isDefault} />
                </SettingsListRow>
              );
            })}
          </SettingsGroup>
        </section>
      ))}
      {editing === 'chatgpt' ? (
        <ChatgptLoginDialog onClose={() => setEditing(null)} />
      ) : editing ? (
        <ModelProviderKeyDialog provider={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
