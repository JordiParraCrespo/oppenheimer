import { Button, Callout, EmptyState, SettingsGroup } from '@oppenheimer/design-system-web';
import { MessageCircle } from '@oppenheimer/design-system-web/icons';
import { useSuspenseWhatsappSettings } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { WHATSAPP_ACCOUNTS_MAX } from '@oppenheimer/shared/schemas/whatsapp';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LinkWhatsappNumberDialog } from '@/features/whatsapp/dialogs/link-whatsapp-number';
import { whatsappHostsOf } from '@/features/whatsapp/lib/whatsapp-hosts';
import { WhatsappAccountRow } from '@/features/whatsapp/sections/whatsapp-account-row';

/**
 * The reader's linked numbers, one row each, and Link a number up to three,
 * over a callout that says to use a spare one. With none yet, the card that
 * says what linking gives the bots; with no host paired, Link is off with
 * that as its reason. Read under Suspense, in the screen's `QueryState`; a
 * refetch that fails keeps the rows and says so above them.
 */
export function WhatsappAccounts() {
  const { t } = useTranslation();
  const { accounts, hosts, error } = useSuspenseWhatsappSettings();
  const [linking, setLinking] = useState(false);
  const choices = whatsappHostsOf(hosts);
  const names = new Map(choices.map((host) => [host.id, host.name]));
  const atLimit = accounts.length >= WHATSAPP_ACCOUNTS_MAX;
  const noHosts = choices.length === 0;

  const link = (
    <Button
      variant={accounts.length === 0 ? 'primary' : 'secondary'}
      size="sm"
      disabled={atLimit || noHosts}
      title={
        atLimit
          ? t('settings.whatsapp.atLimit', { count: WHATSAPP_ACCOUNTS_MAX })
          : noHosts
            ? t('settings.whatsapp.noHosts')
            : undefined
      }
      onClick={() => setLinking(true)}
    >
      {t(accounts.length === 0 ? 'settings.whatsapp.link' : 'settings.whatsapp.linkAnother')}
    </Button>
  );

  return (
    <>
      <Callout className="mb-4">{t('settings.whatsapp.risk')}</Callout>
      <ErrorAlert error={error} fallback={t('settings.whatsapp.loadFailed')} />
      {accounts.length === 0 ? (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <MessageCircle />
            </EmptyState.Media>
            <EmptyState.Title>{t('settings.whatsapp.emptyTitle')}</EmptyState.Title>
            <EmptyState.Description>
              {noHosts ? t('settings.whatsapp.noHosts') : t('settings.whatsapp.emptyDescription')}
            </EmptyState.Description>
          </EmptyState.Header>
          <EmptyState.Content>{link}</EmptyState.Content>
        </EmptyState>
      ) : (
        <>
          <SettingsGroup>
            {accounts.map((account) => (
              <WhatsappAccountRow
                key={account.id}
                account={account}
                hostName={names.get(account.hostId) ?? null}
              />
            ))}
          </SettingsGroup>
          <div className="mt-4 flex justify-end">{link}</div>
        </>
      )}
      {linking ? (
        <LinkWhatsappNumberDialog hosts={choices} onClose={() => setLinking(false)} />
      ) : null}
    </>
  );
}
