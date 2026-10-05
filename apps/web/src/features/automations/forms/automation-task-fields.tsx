import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Textarea,
} from '@oppenheimer/design-system-web';
import type { AutomationTaskDto } from '@oppenheimer/shared/schemas/automation';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The editor's Task step: the name, and what the agent should do on every
 * run. The two typed fields of the automation, registered on the dialog's
 * form and validated by the Task schema the API checks too.
 */
export function AutomationTaskFields({
  register,
  errors,
  autoFocus,
}: {
  register: UseFormRegister<AutomationTaskDto>;
  errors: FieldErrors<AutomationTaskDto>;
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
        <Textarea
          {...register('prompt')}
          id="automation-prompt"
          placeholder={t('automations.editor.promptPlaceholder')}
          aria-invalid={Boolean(errors.prompt)}
          className="min-h-28"
        />
        <FieldDescription>{t('automations.editor.promptHint')}</FieldDescription>
        <FieldError errors={[errors.prompt]} />
      </Field>
    </div>
  );
}
