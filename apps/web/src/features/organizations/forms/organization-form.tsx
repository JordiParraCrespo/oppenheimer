import { Button, Field, FieldError, FieldGroup, Input } from '@oppenheimer/design-system-web';
import { CardFoot, FieldRow, SectionCard, useZodResolver } from '@oppenheimer/frontend-web';
import { updateOrganizationSchema } from '@oppenheimer/shared/schemas/organization';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { LogoPreview } from '@/features/organizations/components/logo-preview';

/**
 * What the card edits: the organization's name and its mark. Both are required
 * on the form even though the API takes each optionally — a card that saves
 * "no name" is not one anybody asked for — and an empty logo means "remove
 * it", which the request spells `null`.
 */
const organizationFormSchema = z.object({
  name: updateOrganizationSchema.shape.name.unwrap(),
  logo: z.string().url().or(z.literal('')),
});

export type OrganizationFormDto = z.infer<typeof organizationFormSchema>;

export function OrganizationForm({
  values,
  disabled,
  isPending,
  saved,
  onChange,
  onSubmit,
}: {
  /** Re-seeds the form whenever the saved organization changes. */
  values: OrganizationFormDto;
  /** True while the organization is still loading, or there is none to edit. */
  disabled: boolean;
  isPending: boolean;
  /** Whether the last submission succeeded and nothing was edited since. */
  saved: boolean;
  /** Called on every user edit, so stale feedback can be cleared. */
  onChange: () => void;
  /** Resolves once the changes are saved; rejects when the request fails. */
  onSubmit: (values: OrganizationFormDto) => Promise<void>;
}) {
  const { t } = useTranslation();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<OrganizationFormDto>({
    resolver: useZodResolver(organizationFormSchema),
    values,
  });

  const [name, logo] = watch(['name', 'logo']);
  const submitting = isPending || isSubmitting;

  const submit = handleSubmit(async (next) => {
    try {
      await onSubmit(next);
    } catch {
      // The section shows the failure; the edits stay for another attempt.
      return;
    }
    reset(next);
  });

  return (
    <form onSubmit={submit} noValidate>
      <FieldGroup className="gap-0">
        <SectionCard>
          <FieldRow label={t('settings.general.name')} hint={t('settings.general.nameHint')}>
            <Field data-invalid={Boolean(errors.name)}>
              <Input
                {...register('name', { onChange })}
                id="organization-name"
                aria-label={t('settings.general.name')}
                aria-invalid={Boolean(errors.name)}
                disabled={submitting || disabled}
              />
              <FieldError errors={[errors.name]} />
            </Field>
          </FieldRow>

          <FieldRow label={t('settings.general.logo')} hint={t('settings.general.logoHint')}>
            <div className="flex items-start gap-4">
              {/* Follows what is typed rather than what is stored, so the field
                  and its preview never disagree mid-edit. */}
              <LogoPreview src={logo} name={name} />
              <Field data-invalid={Boolean(errors.logo)} className="min-w-0 flex-1 gap-2">
                <Input
                  {...register('logo', { onChange })}
                  id="organization-logo"
                  type="url"
                  placeholder="https://…"
                  aria-label={t('settings.general.logoUrl')}
                  aria-invalid={Boolean(errors.logo)}
                  disabled={submitting || disabled}
                />
                <FieldError errors={[errors.logo]} />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  disabled={submitting || logo.length === 0}
                  onClick={() => {
                    onChange();
                    setValue('logo', '', { shouldDirty: true, shouldValidate: true });
                  }}
                >
                  {t('settings.general.remove')}
                </Button>
              </Field>
            </div>
          </FieldRow>

          <CardFoot>
            {saved && (
              <span className="self-center text-sm text-ink-400">{t('settings.saved')}</span>
            )}
            <Button type="submit" size="lg" disabled={submitting || !isDirty}>
              {t('settings.general.save')}
            </Button>
          </CardFoot>
        </SectionCard>
      </FieldGroup>
    </form>
  );
}
