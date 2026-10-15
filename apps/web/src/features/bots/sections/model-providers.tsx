import { Button, SettingsGroup, SettingsListRow, toast } from '@oppenheimer/design-system-web';
import {
  useRemoveModelProviderKey,
  useSuspenseModelProviders,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModelProviderKeyDialog } from '../dialogs/model-provider-key';

/**
 * The providers, one row each: what it serves, whether the workspace has a
 * key (its last four characters), and Add key or Replace and Remove. The key
 * is typed in a dialog and never comes back. Read under Suspense, in the
 * screen's `QueryState`.
 */
export function ModelProviders() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { data: providers, error } = useSuspenseModelProviders();
  const [editing, setEditing] = useState<BotProvider | null>(null);
  const remove = useRemoveModelProviderKey({
    onError: (error) =>
      toast.error(resolveError(error, t('settings.modelProviders.removeFailed')).message),
  });

  return (
    <>
      <ErrorAlert error={error} fallback={t('settings.modelProviders.loadFailed')} />
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
                  {row.configured ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={t('settings.modelProviders.removeLabel', { provider: label })}
                      pending={remove.isPending && remove.variables === row.provider}
                      onClick={() => remove.mutate(row.provider)}
                    >
                      {t('settings.modelProviders.remove')}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="secondary" onClick={() => setEditing(row.provider)}>
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
