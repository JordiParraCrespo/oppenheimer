import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { usePutModelProviderKey } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { BOT_PROVIDER_CATALOG, type BotProvider } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';
import { ModelProviderKeyForm } from '../forms/model-provider-key-form';

/** Add or replace one provider's key. The key goes to the API once and is never shown again. */
export function ModelProviderKeyDialog({
  provider,
  onClose,
}: {
  provider: BotProvider;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const put = usePutModelProviderKey({ onSuccess: onClose });
  const label = BOT_PROVIDER_CATALOG[provider].label;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-105">
        <DialogHeader>
          <DialogTitle>
            {t('settings.modelProviders.dialog.title', { provider: label })}
          </DialogTitle>
          <DialogDescription>
            {t('settings.modelProviders.dialog.description', { provider: label })}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={put.error} fallback={t('settings.modelProviders.dialog.failed')} />
            <ModelProviderKeyForm
              isPending={put.isPending}
              onSubmit={({ apiKey }) => put.mutate({ provider, apiKey })}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
