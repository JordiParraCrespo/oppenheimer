import { Button } from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type BotFormSpec,
  type BotFormValues,
  botFormInputSchema,
} from '@oppenheimer/shared/schemas/bot';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { BotFormFieldControl } from '@/features/bots/components/bot-form-field-control';
import { formInputDefaults, formValuesOf } from '@/features/bots/lib/form-values';

/**
 * The fields of a form a bot asked for, filled and sent. Each field checks
 * itself the way the API will once the person leaves it, so a mistake is
 * said where it is, before the send; Send takes the bot's own word for it
 * when it gave one. Not now declines. Props in, values out: the card above
 * owns the request.
 */
export function BotFormFill({
  spec,
  isPending,
  onSubmit,
  onDismiss,
}: {
  spec: BotFormSpec;
  isPending: boolean;
  onSubmit: (values: BotFormValues) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { control, handleSubmit } = useForm<Record<string, string>>({
    resolver: useZodResolver(botFormInputSchema(spec)),
    defaultValues: formInputDefaults(spec),
    mode: 'onTouched',
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => onSubmit(formValuesOf(spec, input)))}
      className="@container flex flex-col gap-5"
    >
      <div className="grid grid-cols-1 gap-x-4 gap-y-4 @md:grid-cols-2">
        {spec.fields.map((field, index) => (
          <BotFormFieldControl
            key={field.id}
            field={field}
            control={control}
            disabled={isPending}
            autoFocus={index === 0}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss} disabled={isPending}>
          {t('bots.chat.form.dismiss')}
        </Button>
        <Button
          type="submit"
          size="sm"
          pending={isPending}
          pendingLabel={t('bots.chat.form.sending')}
        >
          {spec.submitLabel || t('bots.chat.form.submit')}
        </Button>
      </div>
    </form>
  );
}
