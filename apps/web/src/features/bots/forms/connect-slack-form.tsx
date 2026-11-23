import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  PasswordInput,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type ConnectSlackDto, connectSlackSchema } from '@oppenheimer/shared/schemas/slack';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/**
 * The app's bot token and signing secret, over the shared schema. Both are
 * password fields that start empty every time: the console never has either
 * to show back. The bot is the page's, so it is no field.
 */
export function ConnectSlackForm({
  botId,
  isPending,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  botId: string;
  isPending: boolean;
  submitLabel: string;
  onSubmit: (values: ConnectSlackDto) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ConnectSlackDto>({
    resolver: useZodResolver(connectSlackSchema),
    defaultValues: { botId, botToken: '', signingSecret: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Field data-invalid={Boolean(errors.botToken)}>
        <FieldLabel htmlFor="slackBotToken">{t('bots.settings.slack.tokenField')}</FieldLabel>
        <PasswordInput
          {...register('botToken')}
          id="slackBotToken"
          autoComplete="off"
          spellCheck={false}
          placeholder="xoxb-…"
          aria-invalid={Boolean(errors.botToken)}
          disabled={isPending}
          showLabel={t('bots.settings.slack.show')}
          hideLabel={t('bots.settings.slack.hide')}
        />
        <FieldDescription>{t('bots.settings.slack.tokenHint')}</FieldDescription>
        <FieldError errors={[errors.botToken]} />
      </Field>
      <Field data-invalid={Boolean(errors.signingSecret)}>
        <FieldLabel htmlFor="slackSigningSecret">{t('bots.settings.slack.secretField')}</FieldLabel>
        <PasswordInput
          {...register('signingSecret')}
          id="slackSigningSecret"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(errors.signingSecret)}
          disabled={isPending}
          showLabel={t('bots.settings.slack.show')}
          hideLabel={t('bots.settings.slack.hide')}
        />
        <FieldDescription>{t('bots.settings.slack.secretHint')}</FieldDescription>
        <FieldError errors={[errors.signingSecret]} />
      </Field>
      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
        ) : null}
        <Button
          type="submit"
          pending={isPending}
          pendingLabel={t('bots.settings.slack.connecting')}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
