import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Field,
  FieldError,
  FieldGroup,
  Input,
  toast,
} from '@oppenheimer/design-system-web';
import type { OrganizationEntity } from '@oppenheimer/frontend';
import { useUpdateOrganization } from '@oppenheimer/frontend/react';
import { updateOrganizationSchema } from '@oppenheimer/shared/schemas/organization';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { CardFoot, FieldRow, SectionCard, SectionHead } from '@/components/section-ui';
import { useErrorMessage } from '@/lib/use-error-message';
import { useZodResolver } from '@/lib/use-zod-resolver';

/**
 * What the card edits: the organization's name and its mark. Both are required
 * on the form even though the API takes each optionally — a card that saves
 * "no name" is not one anybody asked for — and an empty logo means "remove
 * it", which the request spells `null`.
 */
const generalFormSchema = z.object({
  name: updateOrganizationSchema.shape.name.unwrap(),
  logo: z.string().url().or(z.literal('')),
});

type GeneralFormDto = z.infer<typeof generalFormSchema>;

export function GeneralSection({
  organization,
  loading,
}: {
  organization: OrganizationEntity | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const update = useUpdateOrganization();
  const [saved, setSaved] = useState(false);

  const defaults: GeneralFormDto = {
    name: organization?.name ?? '',
    logo: organization?.logo ?? '',
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<GeneralFormDto>({
    resolver: useZodResolver(generalFormSchema),
    values: defaults,
  });

  const [name, logo] = watch(['name', 'logo']);
  const submitting = update.isPending || isSubmitting;

  // A success or request failure belongs to the values that produced it. Clear
  // both as soon as the user edits again so feedback never describes stale
  // input. Wiring this to user change handlers avoids treating cache-driven
  // form resets after a successful save as a new edit.
  const clearFeedback = () => {
    setSaved(false);
    update.reset();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!organization) return;

    // Unchanged fields are omitted rather than redundantly written; an empty
    // changed logo means "remove the mark", which the API spells `null`.
    const changes = {
      ...(values.name !== organization.name ? { name: values.name } : {}),
      ...(values.logo !== (organization.logo ?? '') ? { logo: values.logo || null } : {}),
    };

    if (Object.keys(changes).length > 0) {
      await update.mutateAsync({ id: organization.id, changes });
    }

    reset(values);
    setSaved(true);
    toast.success(t('settings.general.saveSuccess'));
  });

  return (
    <>
      <SectionHead title={t('settings.general.title')} sub={t('settings.general.description')} />

      {update.error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(update.error).message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-0">
          <SectionCard>
            <FieldRow label={t('settings.general.name')} hint={t('settings.general.nameHint')}>
              <Field data-invalid={Boolean(errors.name)}>
                <Input
                  {...register('name', { onChange: clearFeedback })}
                  id="organization-name"
                  aria-label={t('settings.general.name')}
                  aria-invalid={Boolean(errors.name)}
                  disabled={submitting || loading || !organization}
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
                    {...register('logo', { onChange: clearFeedback })}
                    id="organization-logo"
                    type="url"
                    placeholder="https://…"
                    aria-label={t('settings.general.logoUrl')}
                    aria-invalid={Boolean(errors.logo)}
                    disabled={submitting || loading || !organization}
                  />
                  <FieldError errors={[errors.logo]} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    disabled={submitting || logo.length === 0}
                    onClick={() => {
                      clearFeedback();
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
    </>
  );
}

/** The 64px preview tile, falling back to the initial. */
function LogoPreview({ src, name }: { src: string | null; name: string }) {
  return (
    <Avatar
      size={64}
      className="flex-none rounded-[14px] border border-border-default bg-card after:rounded-[14px]"
    >
      {src && <AvatarImage src={src} alt="" className="rounded-[14px] object-contain" />}
      <AvatarFallback className="rounded-[14px] bg-card text-xl font-medium text-ink-400">
        {name.trim().charAt(0).toUpperCase() || '—'}
      </AvatarFallback>
    </Avatar>
  );
}
