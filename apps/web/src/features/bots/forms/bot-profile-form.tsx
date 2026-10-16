import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  Input,
  SettingsForm,
  SettingsSaveRow,
  Textarea,
} from '@oppenheimer/design-system-web';
import { ErrorAlert, type ResolvedErrorMessage, useZodResolver } from '@oppenheimer/frontend-web';
import { updateBotSchema } from '@oppenheimer/shared/schemas/bot';
import type { ReactNode } from 'react';
import { type Control, Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/** The Profile card's four fields as the card edits them: the shared schema's own constraints. */
const botProfileSchema = z.object({
  name: updateBotSchema.shape.name.unwrap(),
  description: updateBotSchema.shape.description.unwrap(),
  avatarColor: updateBotSchema.shape.avatarColor.unwrap(),
  groupId: updateBotSchema.shape.groupId.unwrap(),
});

export type BotProfileValues = z.input<typeof botProfileSchema>;
export type BotProfileChanges = Partial<z.output<typeof botProfileSchema>>;
export type BotProfileControl = Control<BotProfileValues>;

/** What differs from the saved bot: only those fields are sent, so an unchanged group keeps its place. */
function changesFrom(saved: BotProfileValues, edited: z.output<typeof botProfileSchema>) {
  const changes: BotProfileChanges = {};
  if (edited.name !== saved.name) changes.name = edited.name;
  if (edited.description !== saved.description) changes.description = edited.description;
  if (edited.avatarColor !== saved.avatarColor) changes.avatarColor = edited.avatarColor;
  if (edited.groupId !== saved.groupId) changes.groupId = edited.groupId;
  return changes;
}

/**
 * The Profile card as one form (`design/version1/BotSettings.dc.html`): Name
 * and Description stacked, then the card's other rows (`children`, handed the
 * form's `control`: the colour and the sidebar group, each binding its own
 * field), then the save row that appears only when something changed and
 * reads Saved after a save until the next edit. Nothing saves before Save.
 * `values` is the saved bot: the form follows it, so a save or a refetch
 * resets the card to what the server holds.
 */
export function BotProfileForm({
  values,
  pending,
  saved,
  error,
  onSubmit,
  onDiscard,
  children,
}: {
  values: BotProfileValues;
  pending: boolean;
  saved: boolean;
  error?: ResolvedErrorMessage;
  onSubmit: (changes: BotProfileChanges) => void;
  onDiscard: () => void;
  children?: (control: BotProfileControl) => ReactNode;
}) {
  const { t } = useTranslation();
  // Controlled fields, not `register`: the React Compiler keeps the ref
  // callbacks `register` hands out, so a reset would not reach the inputs.
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<BotProfileValues>({ resolver: useZodResolver(botProfileSchema), values });

  return (
    <SettingsForm
      noValidate
      onSubmit={handleSubmit((form) => onSubmit(changesFrom(values, botProfileSchema.parse(form))))}
    >
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <div className="px-5 py-4">
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bot-name">{t('bots.settings.profile.name')}</FieldLabel>
              <Input
                {...field}
                id="bot-name"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
                disabled={pending}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          </div>
        )}
      />
      <Controller
        control={control}
        name="description"
        render={({ field, fieldState }) => (
          <div className="border-t border-border-subtle px-5 py-4">
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="bot-description">
                {t('bots.settings.profile.description')}
              </FieldLabel>
              <Textarea
                {...field}
                id="bot-description"
                rows={2}
                placeholder={t('bots.settings.profile.descriptionPlaceholder')}
                aria-invalid={fieldState.invalid}
                disabled={pending}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          </div>
        )}
      />
      {children?.(control)}
      {error ? (
        <div className="border-t border-border-subtle px-5 py-3">
          <ErrorAlert message={error.message} correlationId={error.correlationId} />
        </div>
      ) : null}
      {isDirty ? (
        <SettingsSaveRow>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              reset(values);
              onDiscard();
            }}
          >
            {t('bots.settings.profile.discard')}
          </Button>
          <Button
            type="submit"
            size="sm"
            pending={pending}
            pendingLabel={t('bots.settings.profile.saving')}
          >
            {t('bots.settings.profile.save')}
          </Button>
        </SettingsSaveRow>
      ) : saved ? (
        <SettingsSaveRow role="status">{t('bots.settings.profile.saved')}</SettingsSaveRow>
      ) : null}
    </SettingsForm>
  );
}
