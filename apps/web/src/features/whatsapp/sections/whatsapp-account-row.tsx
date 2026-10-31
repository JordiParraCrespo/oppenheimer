import { Button, SettingsListRow } from '@oppenheimer/design-system-web';
import type { WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { useLinkWhatsapp } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WhatsappQrCard } from '@/features/whatsapp/components/whatsapp-qr-card';
import { WhatsappStatus } from '@/features/whatsapp/components/whatsapp-status';
import { UnlinkWhatsappNumberDialog } from '@/features/whatsapp/dialogs/unlink-whatsapp-number';
import { useQrModules } from '@/features/whatsapp/hooks/use-qr-modules';

/**
 * One linked number: its name over the number, its host and its name on
 * WhatsApp; how its device stands; Pair again (when the device is gone, or a
 * pairing has no code to show) and Unlink. While it pairs, the code to scan
 * is drawn under it. The row owns whether the unlink dialog is open; the
 * dialog owns its write.
 */
export function WhatsappAccountRow({
  account,
  hostName,
}: {
  account: WhatsappAccountEntity;
  hostName: string | null;
}) {
  const { t } = useTranslation();
  const [unlinking, setUnlinking] = useState(false);
  const pair = useLinkWhatsapp();
  const modules = useQrModules(account.isPairing ? account.qr : null);
  const canPair =
    account.hostOnline && (account.needsPairing || (account.isPairing && !account.qr));
  const meta = [
    account.number ?? t('settings.whatsapp.notPairedYet'),
    account.displayName,
    t('settings.whatsapp.onHost', { host: hostName ?? t('settings.whatsapp.unknownHost') }),
    account.statusReason,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <SettingsListRow
        align="center"
        data-testid="whatsapp-account"
        meta={meta}
        kind={<WhatsappStatus status={account.status} hostOnline={account.hostOnline} />}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('settings.whatsapp.unlinkLabel', { label: account.label })}
              onClick={() => setUnlinking(true)}
            >
              {t('settings.whatsapp.unlink')}
            </Button>
            {canPair ? (
              <Button
                size="sm"
                variant="secondary"
                pending={pair.isPending}
                onClick={() => pair.mutate({ hostId: account.hostId })}
              >
                {t('settings.whatsapp.pairAgain')}
              </Button>
            ) : null}
          </>
        }
      >
        {account.label}
      </SettingsListRow>
      {account.isPairing && account.hostOnline ? <WhatsappQrCard modules={modules} /> : null}
      <ErrorAlert
        error={pair.error}
        fallback={t('settings.whatsapp.pairFailed')}
        onDismiss={pair.reset}
      />
      {unlinking ? (
        <UnlinkWhatsappNumberDialog account={account} onClose={() => setUnlinking(false)} />
      ) : null}
    </>
  );
}
