import {
  Button,
  Field,
  FieldError,
  FieldLabel,
  FieldSelect,
  Input,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type LinkWhatsappDto, linkWhatsappSchema } from '@oppenheimer/shared/schemas/whatsapp';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { WhatsappHost } from '@/features/whatsapp/lib/whatsapp-hosts';

/**
 * Which host holds the number, and what to call it, over the shared schema.
 * An offline host can be picked but says so: the link waits for it.
 */
export function LinkWhatsappForm({
  hosts,
  isPending,
  onSubmit,
  onCancel,
}: {
  hosts: readonly WhatsappHost[];
  isPending: boolean;
  onSubmit: (values: LinkWhatsappDto) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LinkWhatsappDto>({
    resolver: useZodResolver(linkWhatsappSchema),
    defaultValues: { hostId: hosts.find((host) => host.online)?.id ?? '', label: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <Field data-invalid={Boolean(errors.hostId)}>
        <FieldLabel>{t('settings.whatsapp.hostField')}</FieldLabel>
        <Controller
          control={control}
          name="hostId"
          render={({ field }) => (
            <FieldSelect
              aria-label={t('settings.whatsapp.hostField')}
              disabled={isPending}
              value={field.value}
              onValueChange={field.onChange}
              options={hosts.map((host) => ({
                value: host.id,
                label: host.online
                  ? host.name
                  : t('settings.whatsapp.hostOfflineOption', { name: host.name }),
              }))}
              placeholder={t('settings.whatsapp.hostPlaceholder')}
              searchPlaceholder={t('settings.whatsapp.searchHosts')}
              emptyText={(query) => t('settings.whatsapp.noHost', { query })}
            />
          )}
        />
        <FieldError errors={[errors.hostId]} />
      </Field>
      <Field data-invalid={Boolean(errors.label)}>
        <FieldLabel htmlFor="whatsappLabel">{t('settings.whatsapp.labelField')}</FieldLabel>
        <Input
          {...register('label')}
          id="whatsappLabel"
          autoComplete="off"
          placeholder={t('settings.whatsapp.labelPlaceholder')}
          aria-invalid={Boolean(errors.label)}
          disabled={isPending}
        />
        <FieldError errors={[errors.label]} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={isPending} pendingLabel={t('settings.whatsapp.linking')}>
          {t('settings.whatsapp.link')}
        </Button>
      </div>
    </form>
  );
}
