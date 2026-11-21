import { Button, Field, FieldError, FieldLabel, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type SynthesisVoiceFormDto,
  synthesisVoiceFormSchema,
} from '@oppenheimer/shared/schemas/voice';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** One field: a voice id as the provider names it, over the shared schema's bounds. */
export function SynthesisVoiceForm({
  initial,
  isPending,
  onSubmit,
  onCancel,
}: {
  initial: string | null;
  isPending: boolean;
  onSubmit: (values: SynthesisVoiceFormDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SynthesisVoiceFormDto>({
    resolver: useZodResolver(synthesisVoiceFormSchema),
    defaultValues: { voice: initial ?? '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.voice)}>
        <FieldLabel htmlFor="synthesisVoice">
          {t('settings.modelProviders.voice.voiceDialog.label')}
        </FieldLabel>
        <Input
          {...register('voice')}
          id="synthesisVoice"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.voice)}
          disabled={isPending}
        />
        <FieldError errors={[errors.voice]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          pending={isPending}
          pendingLabel={t('settings.modelProviders.voice.voiceDialog.saving')}
        >
          {t('settings.modelProviders.voice.voiceDialog.save')}
        </Button>
      </div>
    </form>
  );
}
