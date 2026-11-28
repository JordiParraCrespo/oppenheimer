import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import {
  useAddModelProviderKey,
  usePutModelProviderKey,
  useReplaceModelProviderKey,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { MODEL_PROVIDER_CATALOG } from '@oppenheimer/shared/schemas/model-provider';
import { useTranslation } from 'react-i18next';
import { ModelProviderKeyForm } from '../forms/model-provider-key-form';
import type { ModelProviderKeyTarget } from '../lib/model-provider-key-target';

/**
 * Store one of a provider's keys: its key (added, or replacing the one
 * there), another after the ones there, or one replaced in its place. The key
 * goes to the API once and is never shown again.
 */
export function ModelProviderKeyDialog({
  target,
  onClose,
}: {
  target: ModelProviderKeyTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const put = usePutModelProviderKey({ onSuccess: onClose });
  const add = useAddModelProviderKey({ onSuccess: onClose });
  const replace = useReplaceModelProviderKey({ onSuccess: onClose });
  const { provider } = target;
  const save = target.mode === 'add' ? add : target.mode === 'replace' ? replace : put;
  const label = MODEL_PROVIDER_CATALOG[provider].label;
  const description =
    target.mode === 'add'
      ? t('settings.modelProviders.dialog.addDescription', { provider: label })
      : target.mode === 'replace'
        ? t('settings.modelProviders.dialog.replaceDescription', {
            provider: label,
            hint: target.hint,
          })
        : t('settings.modelProviders.dialog.description', { provider: label });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {t(
              target.mode === 'add'
                ? 'settings.modelProviders.dialog.addTitle'
                : 'settings.modelProviders.dialog.title',
              { provider: label },
            )}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={save.error} fallback={t('settings.modelProviders.dialog.failed')} />
            <ModelProviderKeyForm
              isPending={save.isPending}
              onSubmit={({ apiKey }) => {
                if (target.mode === 'add') add.mutate({ provider, apiKey });
                else if (target.mode === 'replace') {
                  replace.mutate({ provider, keyId: target.keyId, apiKey });
                } else put.mutate({ provider, apiKey });
              }}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
