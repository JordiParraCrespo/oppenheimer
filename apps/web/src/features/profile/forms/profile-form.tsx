import {
  Alert,
  AlertDescription,
  Button,
  FieldError,
  Input,
  SettingsRow,
  SettingsSaveRow,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type UpdateProfileDto,
  updateProfileSchema,
  usernameSchema,
} from '@oppenheimer/shared/schemas/profile';
import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/**
 * The name fields as the form holds them: the username is a string, and an
 * empty one is how it is cleared. The shared schema states the constraints;
 * the names are trimmed so a stray space cannot pass for a name.
 */
const profileFormSchema = z.object({
  firstName: z.string().trim().pipe(updateProfileSchema.shape.firstName.unwrap()),
  lastName: z.string().trim().pipe(updateProfileSchema.shape.lastName.unwrap()),
  username: z.union([z.literal(''), usernameSchema]),
});

export type ProfileFormValues = z.input<typeof profileFormSchema>;

/**
 * Full name and username (`design/version1/Settings.dc.html`), each a row of
 * the profile card, and the save row that appears only when something
 * changed — Discard and Save changes — and reads Saved after a save until
 * the next edit. `values` is the saved profile: the form follows it, so a
 * save or a refetch resets the card to what the server holds.
 *
 * The design draws one Full name field; the account keeps first and last
 * name apart (sign-up asks for both, and the initials are built from them),
 * so the row holds the two side by side.
 */
export function ProfileForm({
  values,
  isPending,
  saved,
  error,
  onSubmit,
  onDiscard,
}: {
  values: ProfileFormValues;
  isPending: boolean;
  /** The last save went through; shown as Saved while nothing is edited. */
  saved: boolean;
  /** The resolved failure message, if the last save failed. */
  error?: string;
  onSubmit: (dto: UpdateProfileDto) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  // Controlled fields, not `register`: the React Compiler keeps the ref
  // callbacks `register` hands out, so a reset — Discard, or the saved
  // profile arriving — would change the form's values and not the inputs.
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: useZodResolver(profileFormSchema),
    values,
  });

  const submit = handleSubmit((form) => {
    const parsed = profileFormSchema.parse(form);
    onSubmit({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      username: parsed.username || null,
    });
  });

  return (
    <>
      <SettingsRow
        label={t('settings.profile.fullName')}
        hint={
          errors.firstName || errors.lastName ? (
            <FieldError errors={[errors.firstName ?? errors.lastName]} />
          ) : undefined
        }
      >
        <Controller
          control={control}
          name="firstName"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              form={formId}
              className="w-34"
              autoComplete="given-name"
              aria-label={t('settings.profile.firstName')}
              aria-invalid={fieldState.invalid}
              disabled={isPending}
            />
          )}
        />
        <Controller
          control={control}
          name="lastName"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              form={formId}
              className="w-34"
              autoComplete="family-name"
              aria-label={t('settings.profile.lastName')}
              aria-invalid={fieldState.invalid}
              disabled={isPending}
            />
          )}
        />
      </SettingsRow>
      <SettingsRow
        label={t('settings.profile.username')}
        hint={
          errors.username ? (
            <FieldError errors={[errors.username]} />
          ) : (
            t('settings.profile.usernameHint')
          )
        }
      >
        <Controller
          control={control}
          name="username"
          render={({ field, fieldState }) => (
            <Input
              {...field}
              form={formId}
              // Handles are lowercase; typing one in capitals is not a
              // mistake worth an error message.
              onChange={(event) => field.onChange(event.target.value.toLowerCase())}
              className="w-70"
              leading={<span className="font-mono text-sm">@</span>}
              autoComplete="username"
              spellCheck={false}
              aria-label={t('settings.profile.username')}
              aria-invalid={fieldState.invalid}
              disabled={isPending}
            />
          )}
        />
      </SettingsRow>
      {error ? (
        <div className="border-t border-border-subtle px-5 py-3">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      {isDirty ? (
        <SettingsSaveRow>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              reset(values);
              onDiscard();
            }}
          >
            {t('settings.profile.discard')}
          </Button>
          <Button type="submit" form={formId} size="sm" disabled={isPending}>
            {isPending ? t('settings.profile.saving') : t('settings.profile.saveChanges')}
          </Button>
        </SettingsSaveRow>
      ) : saved ? (
        <SettingsSaveRow role="status">{t('settings.profile.saved')}</SettingsSaveRow>
      ) : null}
      {/* The rows are the card's own children, so its dividers fall between
          them; the inputs and Save changes reach this form by its id. */}
      <form id={formId} onSubmit={submit} noValidate hidden />
    </>
  );
}
