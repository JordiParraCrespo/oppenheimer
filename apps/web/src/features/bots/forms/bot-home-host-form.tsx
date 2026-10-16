import {
  Button,
  RadioGroup,
  RadioGroupItem,
  SettingsForm,
  SettingsSaveRow,
  StatusDot,
} from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { ErrorAlert, type ResolvedErrorMessage, useZodResolver } from '@oppenheimer/frontend-web';
import { updateBotSchema } from '@oppenheimer/shared/schemas/bot';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

/** The home host as the page edits it: one of the caller's hosts, or none. */
const botHomeHostSchema = z.object({ homeHostId: updateBotSchema.shape.homeHostId.unwrap() });

export type BotHomeHostValues = z.input<typeof botHomeHostSchema>;

/** The radio's value for No home host; a host id is a uuid, so the two never meet. */
const NONE = 'none';

/**
 * Home host as a form: No home host (the bot asks which machine each time),
 * then the caller's hosts, each with whether it is online and what it is. A
 * pick is a draft; the save row (Cancel, Save) appears only when it differs
 * from the saved host, and reads Saved after a save until the next pick. An
 * offline host stays pickable: a session started there waits for it, which
 * is what offline means for a session too. `values` is the saved bot.
 */
export function BotHomeHostForm({
  hosts,
  values,
  pending,
  saved,
  error,
  onSubmit,
  onDiscard,
}: {
  hosts: readonly HostEntity[];
  values: BotHomeHostValues;
  pending: boolean;
  saved: boolean;
  error?: ResolvedErrorMessage;
  onSubmit: (values: { homeHostId: string | null }) => void;
  onDiscard: () => void;
}) {
  const { t } = useTranslation();
  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<BotHomeHostValues>({ resolver: useZodResolver(botHomeHostSchema), values });

  return (
    <SettingsForm
      noValidate
      onSubmit={handleSubmit((form) => onSubmit(botHomeHostSchema.parse(form)))}
    >
      <div className="p-1.5">
        <Controller
          control={control}
          name="homeHostId"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? NONE}
              onValueChange={(value) => field.onChange(value === NONE ? null : value)}
              disabled={pending}
              aria-label={t('bots.settings.homeHost.title')}
            >
              <RadioGroupItem
                value={NONE}
                label={t('bots.settings.homeHost.none')}
                description={t('bots.settings.homeHost.noneHint')}
              />
              {hosts.map((host) => (
                <RadioGroupItem
                  key={host.id}
                  value={host.id}
                  label={<span className="font-mono">{host.name}</span>}
                  description={
                    <StatusDot state={host.online ? 'running' : 'idle'} density="compact">
                      {[
                        host.online
                          ? t('bots.settings.homeHost.online')
                          : t('bots.settings.homeHost.offline'),
                        host.details.osName ?? host.os,
                        host.details.cloudProvider,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </StatusDot>
                  }
                />
              ))}
            </RadioGroup>
          )}
        />
      </div>
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
            {t('bots.settings.homeHost.discard')}
          </Button>
          <Button
            type="submit"
            size="sm"
            pending={pending}
            pendingLabel={t('bots.settings.homeHost.saving')}
          >
            {t('bots.settings.homeHost.save')}
          </Button>
        </SettingsSaveRow>
      ) : saved ? (
        <SettingsSaveRow role="status">{t('bots.settings.homeHost.saved')}</SettingsSaveRow>
      ) : null}
    </SettingsForm>
  );
}
