import {
  Field,
  FieldError,
  FieldLabel,
  FieldSelect,
  Input,
  Textarea,
} from '@oppenheimer/design-system-web';
import type { BotFormField } from '@oppenheimer/shared/schemas/bot';
import { type Control, useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * One field of a bot's form, bound to the form at the leaf, so typing in it
 * redraws this field and no other: its label (with a quiet "Optional" where
 * the bot did not need it), the control its kind takes, and its error under
 * it, said kindly and only once the person has left the field or tried to
 * send. A paragraph spans the card's width; the rest sit two to a row where
 * the card is wide enough.
 */
export function BotFormFieldControl({
  field,
  control,
  disabled,
  autoFocus,
}: {
  field: BotFormField;
  control: Control<Record<string, string>>;
  disabled: boolean;
  autoFocus?: boolean;
}) {
  const { t } = useTranslation();
  const { field: input, fieldState } = useController({ name: field.id, control });
  const id = `bot-form-${field.id}`;
  const invalid = Boolean(fieldState.error);
  const shared = {
    id,
    name: input.name,
    value: input.value ?? '',
    onBlur: input.onBlur,
    ref: input.ref,
    disabled,
    autoFocus,
    placeholder: field.placeholder ?? undefined,
    'aria-invalid': invalid,
    'aria-required': field.required,
  };

  return (
    <Field data-invalid={invalid} className={field.kind === 'textarea' ? '@md:col-span-2' : ''}>
      <FieldLabel htmlFor={id} className="w-full justify-between">
        <span>{field.label}</span>
        {field.required ? null : (
          <span className="font-normal text-xs text-fg-subtle">{t('bots.chat.form.optional')}</span>
        )}
      </FieldLabel>
      {field.kind === 'textarea' ? (
        <Textarea {...shared} rows={3} onChange={(event) => input.onChange(event.target.value)} />
      ) : field.kind === 'select' ? (
        <FieldSelect
          aria-label={field.label}
          options={field.options.map((option) => ({ value: option, label: option }))}
          value={input.value || null}
          onValueChange={(value) => {
            input.onChange(value);
            input.onBlur();
          }}
          placeholder={field.placeholder ?? t('bots.chat.form.choose')}
          searchPlaceholder={t('bots.chat.form.choose')}
          emptyText={() => t('bots.chat.form.choose')}
          disabled={disabled}
        />
      ) : (
        <Input
          {...shared}
          type={field.kind === 'number' ? 'number' : field.kind === 'text' ? 'text' : field.kind}
          inputMode={field.kind === 'number' ? 'decimal' : undefined}
          min={field.kind === 'number' ? (field.min ?? undefined) : undefined}
          max={field.kind === 'number' ? (field.max ?? undefined) : undefined}
          autoComplete={field.kind === 'email' ? 'email' : 'off'}
          onChange={(event) => input.onChange(event.target.value)}
        />
      )}
      <FieldError errors={[fieldState.error]} />
    </Field>
  );
}
