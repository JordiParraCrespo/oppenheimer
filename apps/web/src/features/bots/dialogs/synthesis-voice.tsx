import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { SynthesisVoiceForm } from '../forms/synthesis-voice-form';

/** An ElevenLabs voice by id: one in the account's library, a cloned one included. */
export function SynthesisVoiceDialog({
  initial,
  isPending,
  error,
  onSave,
  onClose,
}: {
  initial: string | null;
  isPending: boolean;
  error: Error | null;
  onSave: (voice: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('settings.modelProviders.voice.voiceDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('settings.modelProviders.voice.voiceDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-4 pb-7">
            <ErrorAlert error={error} fallback={t('settings.modelProviders.voice.saveFailed')} />
            <SynthesisVoiceForm
              initial={initial}
              isPending={isPending}
              onSubmit={({ voice }) => onSave(voice)}
              onCancel={onClose}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
