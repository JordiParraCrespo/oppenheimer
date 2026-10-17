import { Button, Field, FieldError, FieldLabel, Textarea } from '@oppenheimer/design-system-web';
import {
  DictationField,
  dictateIntoField,
  useZodResolver,
  type VoiceInput,
} from '@oppenheimer/frontend-web';
import { type DenyBotApprovalDto, denyBotApprovalSchema } from '@oppenheimer/shared/schemas/bot';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * Deny, with what the person adds: why not, or what the bot should do
 * instead. The note is optional; the bot is told it with the no. It can be
 * dictated.
 */
export function ApprovalNoteForm({
  name,
  voice,
  isPending,
  onSubmit,
  onCancel,
}: {
  name: string;
  voice: VoiceInput;
  isPending: boolean;
  onSubmit: (values: DenyBotApprovalDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<DenyBotApprovalDto>({
    resolver: useZodResolver(denyBotApprovalSchema),
    defaultValues: { note: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <Field data-invalid={Boolean(errors.note)}>
        <FieldLabel htmlFor="approval-note">
          {t('bots.chat.approval.noteLabel', { name })}
        </FieldLabel>
        <DictationField voice={voice} onText={dictateIntoField({ getValues, setValue }, 'note')}>
          <Textarea
            {...register('note')}
            id="approval-note"
            rows={2}
            placeholder={t('bots.chat.approval.notePlaceholder')}
            aria-invalid={Boolean(errors.note)}
            disabled={isPending}
          />
        </DictationField>
        <FieldError errors={[errors.note]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
          {t('bots.chat.approval.cancel')}
        </Button>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          pending={isPending}
          pendingLabel={t('bots.chat.approval.denying')}
        >
          {t('bots.chat.approval.deny')}
        </Button>
      </div>
    </form>
  );
}
