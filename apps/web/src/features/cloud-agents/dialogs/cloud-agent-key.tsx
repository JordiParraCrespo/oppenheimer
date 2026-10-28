import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useConnectCloudAgentProvider } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import {
  CLOUD_AGENT_PROVIDER_LABELS,
  type CloudAgentProviderId,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { useTranslation } from 'react-i18next';
import { CloudAgentKeyForm } from '../forms/cloud-agent-key-form';

/**
 * Connect a vendor, or replace its key. The vendor checks the key before it
 * is stored, so a refusal (a wrong or revoked key) stays here in its words.
 */
export function CloudAgentKeyDialog({
  provider,
  onClose,
}: {
  provider: CloudAgentProviderId;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const connect = useConnectCloudAgentProvider({ onSuccess: onClose });
  const label = CLOUD_AGENT_PROVIDER_LABELS[provider];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('settings.cloudAgents.dialog.title', { provider: label })}</DialogTitle>
          <DialogDescription>
            {t('settings.cloudAgents.dialog.description', { provider: label })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={connect.error} fallback={t('settings.cloudAgents.dialog.failed')} />
            <CloudAgentKeyForm
              isPending={connect.isPending}
              onSubmit={({ apiKey }) => connect.mutate({ provider, apiKey })}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
