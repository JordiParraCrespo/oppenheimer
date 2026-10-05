import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import { type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ProjectFormValues } from '../lib/project-draft';

/**
 * The project's name. Unassigned's is the product's, shown and not edited.
 * Its error is read here, from the form state, so a refused name renders this
 * field and not the dialog.
 */
export function ProjectNameField({
  form,
  fixed,
  pending,
}: {
  form: UseFormReturn<ProjectFormValues>;
  fixed: boolean;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const { errors } = useFormState({ control: form.control, name: 'name' });

  return (
    <Field data-invalid={Boolean(errors.name)}>
      <FieldLabel htmlFor="project-name">{t('projects.dialog.name')}</FieldLabel>
      {fixed ? (
        <Input id="project-name" value={t('projects.unassigned')} readOnly disabled />
      ) : (
        <Input
          {...form.register('name')}
          id="project-name"
          placeholder={t('projects.dialog.namePlaceholder')}
          aria-invalid={Boolean(errors.name)}
          disabled={pending}
          autoFocus
        />
      )}
      <FieldError errors={[errors.name]} />
      {fixed ? <FieldDescription>{t('projects.dialog.unassignedHint')}</FieldDescription> : null}
    </Field>
  );
}
