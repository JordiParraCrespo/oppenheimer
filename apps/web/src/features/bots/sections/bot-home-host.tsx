import { Button, EmptyState, SettingsGroup } from '@oppenheimer/design-system-web';
import { useSuspenseBotAndHosts, useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotHomeHostForm } from '@/features/bots/forms/bot-home-host-form';

/**
 * Home host: where the bot starts a coding session (`start_session`) when
 * nobody names a machine. The bot itself always runs in Oppenheimer, on the
 * control plane; this is never where its turns run. One of the caller's
 * hosts, each with whether it is online now (the list polls while the page
 * is up), or none, and the bot asks. A pick is saved by the form's Save.
 * With no host paired yet the card says so and links to Add a host.
 */
export function BotHomeHost({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { bot, hosts, error } = useSuspenseBotAndHosts(botId);
  const [saved, setSaved] = useState(false);
  const save = useUpdateBot({ onSuccess: () => setSaved(true) });

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow m-0 px-1">{t('bots.settings.homeHost.machines')}</h2>
      <ErrorAlert error={error} fallback={t('bots.settings.homeHost.hostsFailed')} />
      {hosts.length === 0 ? (
        <SettingsGroup>
          <EmptyState compact>
            <EmptyState.Header>
              <EmptyState.Title>{t('bots.settings.homeHost.noHosts')}</EmptyState.Title>
              <EmptyState.Description>
                {t('bots.settings.homeHost.noHostsBody')}
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <Button variant="secondary" size="sm" render={<Link to="/settings/hosts/new" />}>
                {t('bots.settings.homeHost.addHost')}
              </Button>
            </EmptyState.Content>
          </EmptyState>
        </SettingsGroup>
      ) : (
        <BotHomeHostForm
          hosts={hosts}
          values={{ homeHostId: bot.homeHostId }}
          pending={save.isPending}
          saved={saved}
          error={
            save.error ? resolveError(save.error, t('bots.settings.homeHost.failed')) : undefined
          }
          onSubmit={(input) => {
            setSaved(false);
            save.mutate({ id: bot.id, input });
          }}
          onDiscard={() => save.reset()}
        />
      )}
    </section>
  );
}
