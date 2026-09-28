import {
  Alert,
  AlertDescription,
  Button,
  FieldError,
  Input,
  SettingsForm,
  SettingsRow,
  SettingsSaveRow,
} from '@oppenheimer/design-system-web';
import {
  type ResolvedErrorMessage,
  useServerFieldErrors,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import {
  type UpdateProfileDto,
  updateProfileSchema,
  usernameSchema,
} from '@oppenheimer/shared/schemas/profile';
import type * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/**
 * The name fields as the form holds them: the username is a string, and an
 * empty one is how it is cleared. The shared schemas are the contract — the
 * username's normalises (trims, lowercases) as it checks — and the names are
 * trimmed so a stray space cannot pass for one.
 */
const profileFormSchema = z.object({
  firstName: z.string().trim().pipe(updateProfileSchema.shape.firstName.unwrap()),
  lastName: z.string().trim().pipe(updateProfileSchema.shape.lastName.unwrap()),
  username: z.union([z.literal(''), usernameSchema]),
});

export type ProfileFormValues = z.input<typeof profileFormSchema>;

/**
 * The profile card (`design/version1/Settings.dc.html`) as one form: the rows
 * above the fields (`children` — picture, email) are the card's too, then
 * Full name and Username, then the save row that appears only when something
 * changed and reads Saved after a save until the next edit. `values` is the
 * saved profile: the form follows it, so a save or a refetch resets the card
 * to what the server holds.
 *
 * Full name is two fields: the account keeps first and last name apart.
 */
export function ProfileForm({
  values,
  isPending,
  saved,
  error,
  onSubmit,
  onDiscard,
  children,
}: {
  values: ProfileFormValues;
  isPending: boolean;
  /** The last save went through; shown as Saved while nothing is edited. */
  saved: boolean;
  /** The resolved failure message, if the last save failed. */
  error?: ResolvedErrorMessage;
  onSubmit: (dto: UpdateProfileDto) => void;
  onDiscard: () => void;
  /** The card's rows above the fields, which save on their own. */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  // Controlled fields, not `register`: the React Compiler keeps the ref
  // callbacks `register` hands out, so a reset — Discard, or the saved
  // profile arriving — would change the form's values and not the inputs.
  const {
    setError,
    getValues,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormValues>({
    resolver: useZodResolver(profileFormSchema),
    values,
  });
  // Fields the server refused are marked on the fields; the alert keeps the rest.
  const { showAlert } = useServerFieldErrors({ setError, getValues }, error);

  const submit = handleSubmit((form) => {
    const parsed = profileFormSchema.parse(form);
    onSubmit({
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      username: parsed.username || null,
    });
  });

  return (
    <SettingsForm onSubmit={submit} noValidate>
      {children}
      <SettingsRow
        label={t('settings.profile.fullName')}
        control="field"
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
        control="field"
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
      {error && showAlert ? (
        <div className="border-t border-border-subtle px-5 py-3">
          <Alert variant="destructive">
            <AlertDescription>{error.message}</AlertDescription>
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
          <Button
            type="submit"
            size="sm"
            pending={isPending}
            pendingLabel={t('settings.profile.saving')}
          >
            {t('settings.profile.saveChanges')}
          </Button>
        </SettingsSaveRow>
      ) : saved ? (
        <SettingsSaveRow role="status">{t('settings.profile.saved')}</SettingsSaveRow>
      ) : null}
    </SettingsForm>
  );
}
