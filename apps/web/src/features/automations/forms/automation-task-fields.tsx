import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from '@oppenheimer/design-system-web';
import { DictationField, type VoiceInput } from '@oppenheimer/frontend-web';
import type { AutomationTaskDto } from '@oppenheimer/shared/schemas/automation';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The editor's Task step: the name, and what the agent should do on every
 * run. The two typed fields of the automation, registered on the dialog's
 * form and validated by the Task schema the API checks too. The prompt can be
 * dictated; what is heard goes to `onDictatePrompt`, which adds it to the
 * form's field.
 */
export function AutomationTaskFields({
  register,
  errors,
  voice,
  onDictatePrompt,
  autoFocus,
}: {
  register: UseFormRegister<AutomationTaskDto>;
  errors: FieldErrors<AutomationTaskDto>;
  voice: VoiceInput;
  onDictatePrompt: (text: string) => void;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.name)}>
        <FieldLabel htmlFor="automation-name">{t('automations.editor.name')}</FieldLabel>
        <Input
          {...register('name')}
          id="automation-name"
          placeholder={t('automations.editor.namePlaceholder')}
          aria-invalid={Boolean(errors.name)}
          autoFocus={autoFocus}
        />
        <FieldError errors={[errors.name]} />
      </Field>
      <Field data-invalid={Boolean(errors.prompt)}>
        <FieldLabel htmlFor="automation-prompt">{t('automations.editor.prompt')}</FieldLabel>
        <DictationField voice={voice} onText={onDictatePrompt}>
          <Textarea
            {...register('prompt')}
            id="automation-prompt"
            placeholder={t('automations.editor.promptPlaceholder')}
            aria-invalid={Boolean(errors.prompt)}
            className="min-h-28"
          />
        </DictationField>
        <FieldDescription>{t('automations.editor.promptHint')}</FieldDescription>
        <FieldError errors={[errors.prompt]} />
      </Field>
    </div>
  );
}
