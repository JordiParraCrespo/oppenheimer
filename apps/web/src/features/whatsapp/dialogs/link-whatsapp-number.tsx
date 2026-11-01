import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { useLinkWhatsapp } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { LinkWhatsappForm } from '@/features/whatsapp/forms/link-whatsapp-form';
import type { WhatsappHost } from '@/features/whatsapp/lib/whatsapp-hosts';

/** Link a number: pick the host that holds it; its row then shows the QR code to scan. */
export function LinkWhatsappNumberDialog({
  hosts,
  onClose,
}: {
  hosts: readonly WhatsappHost[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const link = useLinkWhatsapp({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('settings.whatsapp.linkTitle')}</DialogTitle>
          <DialogDescription>{t('settings.whatsapp.linkDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={link.error} fallback={t('settings.whatsapp.linkFailed')} />
            <LinkWhatsappForm
              hosts={hosts}
              isPending={link.isPending}
              onSubmit={({ hostId, label }) => link.mutate({ hostId, label: label || undefined })}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
