import { Button, Callout, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import type { CloudAgentProviderStatus } from '@oppenheimer/frontend-consumer';
import {
  useDisconnectCloudAgentProvider,
  useSuspenseCloudAgentStatus,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import type { CloudAgentProviderId } from '@oppenheimer/shared/schemas/cloud-agent';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudAgentKeyDialog } from '../dialogs/cloud-agent-key';

/**
 * The cloud agent vendors, one row each: what it runs, whose key is stored
 * (its name, the account and its last four characters), and Connect, or
 * Replace key and Disconnect. The key is typed in a dialog and never comes
 * back. A server that cannot seal a key says so above the rows, whose
 * buttons are then off with that as their reason. Read under Suspense, in the
 * screen's `QueryState`.
 */
export function CloudAgentProviders() {
  const { t } = useTranslation();
  const { data: status, error } = useSuspenseCloudAgentStatus();
  const [editing, setEditing] = useState<CloudAgentProviderId | null>(null);
  const disconnect = useDisconnectCloudAgentProvider();
  const unavailable = status.configured ? undefined : t('settings.cloudAgents.unavailable');

  const kind = (row: CloudAgentProviderStatus) => {
    if (!row.connected || !row.keyName || !row.keyHint)
      return t('settings.cloudAgents.notConnected');
    return row.accountEmail
      ? t('settings.cloudAgents.connectedAs', {
          name: row.keyName,
          email: row.accountEmail,
          hint: row.keyHint,
        })
      : t('settings.cloudAgents.connectedKey', { name: row.keyName, hint: row.keyHint });
  };

  return (
    <>
      {unavailable ? <Callout className="mb-4">{unavailable}</Callout> : null}
      <ErrorAlert error={error} fallback={t('settings.cloudAgents.loadFailed')} />
      <ErrorAlert
        error={disconnect.error}
        fallback={t('settings.cloudAgents.disconnectFailed')}
        onDismiss={() => disconnect.reset()}
      />
      <SettingsGroup>
        {status.providers.map((row) => (
          <SettingsListRow
            key={row.id}
            align="center"
            data-testid="cloud-agent-provider"
            meta={t(`settings.cloudAgents.providers.${row.id}`)}
            kind={kind(row)}
            actions={
              <>
                {row.connected ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={t('settings.cloudAgents.disconnectLabel', { provider: row.label })}
                    pending={disconnect.isPending && disconnect.variables === row.id}
                    onClick={() => disconnect.mutate(row.id)}
                  >
                    {t('settings.cloudAgents.disconnect')}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={unavailable !== undefined}
                  title={unavailable}
                  onClick={() => setEditing(row.id)}
                >
                  {t(
                    row.connected ? 'settings.cloudAgents.replace' : 'settings.cloudAgents.connect',
                  )}
                </Button>
              </>
            }
          >
            {row.label}
          </SettingsListRow>
        ))}
      </SettingsGroup>
      {editing ? <CloudAgentKeyDialog provider={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}
