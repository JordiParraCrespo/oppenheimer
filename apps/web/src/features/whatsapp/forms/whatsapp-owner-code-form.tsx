import { Button, Field, FieldError, Input } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type ConfirmWhatsappOwnerDto,
  confirmWhatsappOwnerSchema,
} from '@oppenheimer/shared/schemas/whatsapp';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The six-digit code the reader's number received, in place in the "Your
 * number" row, and Confirm. The schema is the API's
 * (`confirmWhatsappOwnerSchema`); a code the route refuses (wrong, expired,
 * too many tries) is `error`, already translated, under the input.
 */
export function WhatsappOwnerCodeForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error?: string;
  onSubmit: (code: string) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConfirmWhatsappOwnerDto>({
    resolver: useZodResolver(confirmWhatsappOwnerSchema),
    defaultValues: { code: '' },
  });
  const invalid = Boolean(errors.code) || Boolean(error);

  return (
    <form onSubmit={handleSubmit(({ code }) => onSubmit(code))} noValidate>
      <Field data-invalid={invalid}>
        <div className="flex items-center gap-1.5">
          <Input
            {...register('code')}
            size="sm"
            mono
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            className="w-24"
            placeholder={t('settings.whatsapp.owner.codePlaceholder')}
            aria-label={t('settings.whatsapp.owner.codeLabel')}
            aria-invalid={invalid}
            autoFocus
          />
          <Button
            type="submit"
            size="sm"
            variant="primary"
            pending={pending}
            pendingLabel={t('settings.whatsapp.owner.confirming')}
          >
            {t('settings.whatsapp.owner.confirm')}
          </Button>
        </div>
        <FieldError errors={[errors.code]}>{error}</FieldError>
      </Field>
    </form>
  );
}
