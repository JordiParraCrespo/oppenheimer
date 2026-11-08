import {
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldSelect,
  Input,
  PasswordInput,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type LinkTelegramDto, linkTelegramSchema } from '@oppenheimer/shared/schemas/telegram';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { TelegramHost } from '@/features/telegram/lib/telegram-hosts';

/**
 * Which host polls the bot, its token from @BotFather, and what to call it,
 * over the shared schema. The token field is a password field that starts
 * empty every time: the console never has a token to show back. An offline
 * host can be picked but says so: the connect waits for it. Connecting a
 * bot again (a revoked token) fixes the host and keeps its name.
 */
export function ConnectTelegramForm({
  hosts,
  fixedHostId,
  defaultLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  hosts: readonly TelegramHost[];
  fixedHostId?: string;
  defaultLabel?: string;
  isPending: boolean;
  onSubmit: (values: LinkTelegramDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LinkTelegramDto>({
    resolver: useZodResolver(linkTelegramSchema),
    defaultValues: {
      hostId: fixedHostId ?? hosts.find((host) => host.online)?.id ?? '',
      token: '',
      label: defaultLabel ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {fixedHostId ? null : (
        <Field data-invalid={Boolean(errors.hostId)}>
          <FieldLabel>{t('settings.telegram.hostField')}</FieldLabel>
          <Controller
            control={control}
            name="hostId"
            render={({ field }) => (
              <FieldSelect
                aria-label={t('settings.telegram.hostField')}
                disabled={isPending}
                value={field.value}
                onValueChange={field.onChange}
                options={hosts.map((host) => ({
                  value: host.id,
                  label: host.online
                    ? host.name
                    : t('settings.telegram.hostOfflineOption', { name: host.name }),
                }))}
                placeholder={t('settings.telegram.hostPlaceholder')}
                searchPlaceholder={t('settings.telegram.searchHosts')}
                emptyText={(query) => t('settings.telegram.noHost', { query })}
              />
            )}
          />
          <FieldError errors={[errors.hostId]} />
        </Field>
      )}
      <Field data-invalid={Boolean(errors.token)}>
        <FieldLabel htmlFor="telegramToken">{t('settings.telegram.tokenField')}</FieldLabel>
        <PasswordInput
          {...register('token')}
          id="telegramToken"
          autoComplete="off"
          spellCheck={false}
          placeholder="123456789:AA…"
          aria-invalid={Boolean(errors.token)}
          disabled={isPending}
          showLabel={t('settings.telegram.showToken')}
          hideLabel={t('settings.telegram.hideToken')}
        />
        <FieldDescription>{t('settings.telegram.tokenHint')}</FieldDescription>
        <FieldError errors={[errors.token]} />
      </Field>
      <Field data-invalid={Boolean(errors.label)}>
        <FieldLabel htmlFor="telegramLabel">{t('settings.telegram.labelField')}</FieldLabel>
        <Input
          {...register('label')}
          id="telegramLabel"
          autoComplete="off"
          placeholder={t('settings.telegram.labelPlaceholder')}
          aria-invalid={Boolean(errors.label)}
          disabled={isPending}
        />
        <FieldError errors={[errors.label]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={isPending} pendingLabel={t('settings.telegram.connecting')}>
          {t('settings.telegram.connectSubmit')}
        </Button>
      </div>
    </form>
  );
}
