import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { GmailConnectionEntity } from '@oppenheimer/frontend-consumer';
import { useRenameGmailConnection } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { GmailLabelForm } from '@/features/mail/forms/gmail-label-form';

/** Rename an account: the name the reader and their bots know it by ("Personal", "Work"). */
export function RenameGmailAccountDialog({
  connection,
  onClose,
}: {
  connection: GmailConnectionEntity;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const rename = useRenameGmailConnection({ onSuccess: onClose });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('settings.mail.renameTitle')}</DialogTitle>
          <DialogDescription>
            {t('settings.mail.renameDescription', { email: connection.accountEmail })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={rename.error} fallback={t('settings.mail.renameFailed')} />
            <GmailLabelForm
              label={connection.label}
              isPending={rename.isPending}
              onSubmit={({ label }) => rename.mutate({ id: connection.id, label })}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
