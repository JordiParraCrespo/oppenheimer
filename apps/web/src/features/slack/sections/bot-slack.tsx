import { Button, Callout, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import { useSuspenseBotSlack } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlackStatus } from '@/features/slack/components/slack-status';
import { DisconnectSlackDialog } from '@/features/slack/dialogs/disconnect-slack';
import { ReplaceSlackTokenDialog } from '@/features/slack/dialogs/replace-slack-token';
import { SlackOwnerLink } from '@/features/slack/sections/slack-owner-link';
import { SlackSetup } from '@/features/slack/sections/slack-setup';

/**
 * The bot's Slack app: with none yet, the steps that create and connect it;
 * once connected, the app as Slack names it, how it stands, and New token and
 * Disconnect, with the owner link under it until the reader's Slack user is
 * recorded. Read under Suspense, in the screen's `QueryState`; a refetch that
 * fails keeps the page and says so.
 */
export function BotSlack({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { account, setup, error } = useSuspenseBotSlack(botId);
  const [open, setOpen] = useState<'replace' | 'disconnect' | null>(null);

  return (
    <>
      <Callout className="mb-4">{t('bots.settings.slack.howItWorks')}</Callout>
      <ErrorAlert error={error} fallback={t('bots.settings.slack.loadFailed')} />
      {account ? (
        <SettingsGroup>
          <SettingsListRow
            align="center"
            data-testid="slack-app"
            meta={[
              t('bots.settings.slack.inWorkspace', { team: account.teamName }),
              t('bots.settings.slack.tokenEnding', { hint: account.tokenHint }),
              account.statusReason,
            ]
              .filter(Boolean)
              .join(' · ')}
            kind={<SlackStatus account={account} />}
            actions={
              <>
                <Button size="sm" variant="ghost" onClick={() => setOpen('disconnect')}>
                  {t('bots.settings.slack.disconnect')}
                </Button>
                <Button
                  size="sm"
                  variant={account.needsToken ? 'primary' : 'secondary'}
                  onClick={() => setOpen('replace')}
                >
                  {t('bots.settings.slack.replace')}
                </Button>
              </>
            }
          >
            @{account.botName}
          </SettingsListRow>
          {account.ownerLinked || account.needsToken ? null : <SlackOwnerLink account={account} />}
        </SettingsGroup>
      ) : (
        <SlackSetup botId={botId} setup={setup} />
      )}
      {account && open === 'replace' ? (
        <ReplaceSlackTokenDialog account={account} onClose={() => setOpen(null)} />
      ) : null}
      {account && open === 'disconnect' ? (
        <DisconnectSlackDialog account={account} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
