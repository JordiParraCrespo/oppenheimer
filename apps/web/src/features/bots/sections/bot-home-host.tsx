import {
  Button,
  EmptyState,
  RadioGroup,
  RadioGroupItem,
  SettingsGroup,
  StatusDot,
} from '@oppenheimer/design-system-web';
import { useSuspenseBotAndHosts, useUpdateBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Home host: the machine the bot's turns run on, one of the caller's hosts,
 * each with whether it is online now (the list polls while the page is up)
 * and what it is. A pick saves at once. An offline host stays pickable: the
 * bot's work waits for it, which is what offline means for a session too.
 * With no host paired yet the card says so and links to Add a host.
 */
export function BotHomeHost({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { bot, hosts, error } = useSuspenseBotAndHosts(botId);
  const update = useUpdateBot();
  const picked = update.isPending ? update.variables.input.homeHostId : bot.homeHostId;

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="eyebrow m-0 px-1">{t('bots.settings.runsOn.homeHost')}</h2>
      <ErrorAlert error={error} fallback={t('bots.settings.runsOn.hostsFailed')} />
      {hosts.length === 0 ? (
        <SettingsGroup>
          <EmptyState compact>
            <EmptyState.Header>
              <EmptyState.Title>{t('bots.settings.runsOn.noHosts')}</EmptyState.Title>
              <EmptyState.Description>
                {t('bots.settings.runsOn.noHostsBody')}
              </EmptyState.Description>
            </EmptyState.Header>
            <EmptyState.Content>
              <Button variant="secondary" size="sm" render={<Link to="/settings/hosts/new" />}>
                {t('bots.settings.runsOn.addHost')}
              </Button>
            </EmptyState.Content>
          </EmptyState>
        </SettingsGroup>
      ) : (
        <SettingsGroup>
          <div className="p-1.5">
            <RadioGroup
              value={picked ?? ''}
              onValueChange={(homeHostId) => update.mutate({ id: bot.id, input: { homeHostId } })}
              aria-label={t('bots.settings.runsOn.homeHost')}
            >
              {hosts.map((host) => (
                <RadioGroupItem
                  key={host.id}
                  value={host.id}
                  label={<span className="font-mono">{host.name}</span>}
                  description={
                    <StatusDot state={host.online ? 'running' : 'idle'} density="compact">
                      {[
                        host.online
                          ? t('bots.settings.runsOn.online')
                          : t('bots.settings.runsOn.offline'),
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
          </div>
        </SettingsGroup>
      )}
      <ErrorAlert
        error={update.error}
        fallback={t('bots.settings.runsOn.failed')}
        onDismiss={() => update.reset()}
      />
    </section>
  );
}
