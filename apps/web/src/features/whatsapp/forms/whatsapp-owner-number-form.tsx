import { Button, Field, FieldError, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type RequestWhatsappOwnerDto,
  requestWhatsappOwnerSchema,
} from '@oppenheimer/shared/schemas/whatsapp';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The reader's own number, in place in the "Your number" row: one input, Send
 * code, and Cancel when there is a step to go back to. The schema is the
 * API's (`requestWhatsappOwnerSchema`), so a number the route would refuse is
 * refused here first; what it refuses anyway (the linked number itself) is
 * `error`, already translated, under the input.
 */
export function WhatsappOwnerNumberForm({
  pending,
  disabled,
  error,
  onSubmit,
  onCancel,
}: {
  pending: boolean;
  /** Nothing can be sent: the host that holds the number is offline. */
  disabled: boolean;
  error?: string;
  onSubmit: (phone: string) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestWhatsappOwnerDto>({
    resolver: useZodResolver(requestWhatsappOwnerSchema),
    defaultValues: { phone: '' },
  });
  const invalid = Boolean(errors.phone) || Boolean(error);

  return (
    <form onSubmit={handleSubmit(({ phone }) => onSubmit(phone))} noValidate>
      <Field data-invalid={invalid}>
        <div className="flex items-center gap-1.5">
          <Input
            {...register('phone')}
            size="sm"
            mono
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="w-44"
            placeholder={t('settings.whatsapp.owner.numberPlaceholder')}
            aria-label={t('settings.whatsapp.owner.numberLabel')}
            aria-invalid={invalid}
            disabled={disabled}
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            pending={pending}
            pendingLabel={t('settings.whatsapp.owner.sending')}
            disabled={disabled}
          >
            {t('settings.whatsapp.owner.send')}
          </Button>
          {onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </div>
        <FieldError errors={[errors.phone]}>{error}</FieldError>
      </Field>
    </form>
  );
}
