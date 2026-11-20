import { Button } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import type { SlackAppSetup } from '@oppenheimer/frontend-consumer';
import { useConnectSlack } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CopyLine } from '@/features/slack/components/copy-line';
import { SlackStep } from '@/features/slack/components/slack-step';
import { ConnectSlackForm } from '@/features/slack/forms/connect-slack-form';

/**
 * Giving the bot its own Slack app, in three steps: create it in Slack from
 * the bot's manifest (its name, the scopes and events it needs, and its
 * events address, all filled in), install it to the workspace, and paste the
 * bot token and signing secret Slack shows then. The address is shown too,
 * for an app made by hand.
 */
export function SlackSetup({ botId, setup }: { botId: string; setup: SlackAppSetup }) {
  const { t } = useTranslation();
  const connect = useConnectSlack();
  return (
    <ol
      data-testid="slack-setup"
      className="flex flex-col gap-5 rounded-md border border-border-subtle bg-surface-card p-4"
    >
      <SlackStep
        n={1}
        label={t('bots.settings.slack.stepCreate')}
        hint={t('bots.settings.slack.stepCreateHint')}
      >
        <Button
          size="sm"
          variant="primary"
          className="w-fit"
          nativeButton={false}
          render={<a href={setup.createUrl} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink />
          {t('bots.settings.slack.createInSlack')}
        </Button>
        <CopyLine text={setup.eventsUrl} label={t('bots.settings.slack.copyEventsUrl')} />
      </SlackStep>
      <SlackStep
        n={2}
        label={t('bots.settings.slack.stepInstall')}
        hint={t('bots.settings.slack.stepInstallHint')}
      />
      <SlackStep
        n={3}
        label={t('bots.settings.slack.stepPaste')}
        hint={t('bots.settings.slack.stepPasteHint')}
      >
        <ErrorAlert error={connect.error} fallback={t('bots.settings.slack.connectFailed')} />
        <ConnectSlackForm
          botId={botId}
          isPending={connect.isPending}
          submitLabel={t('bots.settings.slack.connect')}
          onSubmit={(values) => connect.mutate(values)}
        />
      </SlackStep>
    </ol>
  );
}
