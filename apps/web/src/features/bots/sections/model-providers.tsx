import { SettingsGroup, SettingsHeading, SettingsListRow } from '@oppenheimer/design-system-web';
import {
  useRemoveModelProviderKey,
  useRemoveModelProviderKeyById,
  useSetDefaultModelProvider,
  useSuspenseModelProviders,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { MODEL_PROVIDER_KEYS_MAX } from '@oppenheimer/shared/schemas/bot';
import { isBotProvider, MODEL_PROVIDER_CATALOG } from '@oppenheimer/shared/schemas/model-provider';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModelProviderActions } from '../components/model-provider-actions';
import { ModelProviderKeyActions } from '../components/model-provider-key-actions';
import { ModelProviderKeyStatus } from '../components/model-provider-key-status';
import { ModelProviderName } from '../components/model-provider-name';
import { ModelProviderStatus } from '../components/model-provider-status';
import { ChatgptLoginDialog } from '../dialogs/chatgpt-login';
import { ModelProviderKeyDialog } from '../dialogs/model-provider-key';
import { groupModelProviders } from '../lib/model-provider-groups';
import { modelProviderKeyNotes } from '../lib/model-provider-key-note';
import type { ModelProviderKeyTarget } from '../lib/model-provider-key-target';

/**
 * The providers, bots' and voice-only ones (Groq, ElevenLabs), in two cards: Connected (a key or a sign-in) above, Not
 * connected below, each headed by how many it holds and in catalog order
 * within; a card with none is left out. One row each: the provider's mark and
 * name, what it serves, the key's last four characters behind a green check,
 * and Add key or Replace and Remove. The one new bots start on carries a
 * Default badge; another bot provider with a key offers Make default (a
 * voice-only one never does: no bot runs on it). A key provider takes up to
 * `MODEL_PROVIDER_KEYS_MAX` keys (Add key): a call runs on the first that is
 * not out of credit and moves to the next when one runs out. With more than
 * one, each key is a row of its own under the provider's, in that order,
 * with its own Remove and Replace, and a key out of credit says so. The
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
  const [editing, setEditing] = useState<ModelProviderKeyTarget | null>(null);
  const remove = useRemoveModelProviderKey();
  const removeKey = useRemoveModelProviderKeyById();
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
        error={removeKey.error}
        fallback={t('settings.modelProviders.removeFailed')}
        onDismiss={() => removeKey.reset()}
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
              const { label, auth } = MODEL_PROVIDER_CATALOG[row.provider];
              const runsBots = isBotProvider(row.provider);
              const signIn = auth === 'sign_in';
              const perKey = !signIn && row.keys.length > 1;
              const notes = modelProviderKeyNotes(row.keys);
              // A key provider's one key is acted on by its id, never the provider's
              // whole set: a key another tab added meanwhile is not removed unseen.
              const onlyKey = !signIn && row.keys.length === 1 ? row.keys[0] : null;
              return (
                <Fragment key={row.provider}>
                  <SettingsListRow
                    align="center"
                    data-testid="model-provider"
                    meta={t(`settings.modelProviders.providers.${row.provider}`)}
                    kind={
                      <ModelProviderStatus
                        signIn={signIn}
                        hint={row.configured ? row.keyHint : null}
                        keys={row.keys}
                      />
                    }
                    actions={
                      <ModelProviderActions
                        label={label}
                        signIn={signIn}
                        configured={row.configured}
                        isDefault={row.isDefault}
                        runsBots={runsBots}
                        unavailableReason={unavailableReason}
                        makingDefault={
                          makeDefault.isPending && makeDefault.variables === row.provider
                        }
                        defaultBusy={makeDefault.isPending}
                        removing={
                          onlyKey
                            ? removeKey.isPending && removeKey.variables?.keyId === onlyKey.id
                            : remove.isPending && remove.variables === row.provider
                        }
                        keyCount={row.keys.length}
                        canAddKey={
                          !signIn && row.configured && row.keys.length < MODEL_PROVIDER_KEYS_MAX
                        }
                        onMakeDefault={() => {
                          if (isBotProvider(row.provider)) makeDefault.mutate(row.provider);
                        }}
                        onRemove={() =>
                          onlyKey
                            ? removeKey.mutate({ provider: row.provider, keyId: onlyKey.id })
                            : remove.mutate(row.provider)
                        }
                        onEdit={() =>
                          setEditing(
                            onlyKey
                              ? {
                                  mode: 'replace',
                                  provider: row.provider,
                                  keyId: onlyKey.id,
                                  hint: onlyKey.keyHint,
                                }
                              : { mode: 'put', provider: row.provider },
                          )
                        }
                        onAddKey={() => setEditing({ mode: 'add', provider: row.provider })}
                      />
                    }
                  >
                    <ModelProviderName provider={row.provider} isDefault={row.isDefault} />
                  </SettingsListRow>
                  {perKey
                    ? row.keys.map((key, index) => (
                        <SettingsListRow
                          key={key.id}
                          align="center"
                          className="pl-12"
                          data-testid="model-provider-key"
                          kind={
                            <ModelProviderKeyStatus
                              hint={key.keyHint}
                              spent={key.spentAt !== null}
                            />
                          }
                          meta={t(`settings.modelProviders.${notes.get(key.id) ?? 'keyNext'}`)}
                          actions={
                            <ModelProviderKeyActions
                              label={label}
                              hint={key.keyHint}
                              unavailableReason={unavailableReason}
                              removing={
                                removeKey.isPending && removeKey.variables?.keyId === key.id
                              }
                              onRemove={() =>
                                removeKey.mutate({ provider: row.provider, keyId: key.id })
                              }
                              onReplace={() =>
                                setEditing({
                                  mode: 'replace',
                                  provider: row.provider,
                                  keyId: key.id,
                                  hint: key.keyHint,
                                })
                              }
                            />
                          }
                        >
                          {t('settings.modelProviders.keyNumber', { number: index + 1 })}
                        </SettingsListRow>
                      ))
                    : null}
                </Fragment>
              );
            })}
          </SettingsGroup>
        </section>
      ))}
      {editing?.provider === 'chatgpt' ? (
        <ChatgptLoginDialog onClose={() => setEditing(null)} />
      ) : editing ? (
        <ModelProviderKeyDialog target={editing} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}
