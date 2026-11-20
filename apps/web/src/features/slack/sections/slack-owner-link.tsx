import { Button } from '@oppenheimer/design-system-web';
import { ExternalLink } from '@oppenheimer/design-system-web/icons';
import type { SlackAccountEntity } from '@oppenheimer/frontend-consumer';
import { useOpenSlackOwnerLink, useRefreshSlack } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CopyLine } from '@/features/slack/components/copy-line';
import { SlackStep } from '@/features/slack/components/slack-step';

/**
 * Recording the reader's Slack user as the app's owner, the only person the
 * bot answers in Slack: a one-time code made on request, to send the app in
 * its DM within ten minutes, then Check, which asks whether it took. New code
 * makes another when it has expired.
 */
export function SlackOwnerLink({ account }: { account: SlackAccountEntity }) {
  const { t } = useTranslation();
  const ownerLink = useOpenSlackOwnerLink();
  const refresh = useRefreshSlack();
  const link = ownerLink.data;

  return (
    <div data-testid="slack-owner-link" className="flex flex-col gap-3 px-5 pt-1 pb-4">
      <p className="text-sm text-fg-muted">
        {t('bots.settings.slack.ownerIntro', { name: account.botName })}
      </p>
      <ErrorAlert error={ownerLink.error} fallback={t('bots.settings.slack.ownerLinkFailed')} />
      {link ? (
        <ol className="flex max-w-140 flex-col gap-3 rounded-sm border border-border-subtle bg-hover-surface p-3.5">
          <SlackStep
            n={1}
            label={t('bots.settings.slack.ownerStepOpen', { name: account.botName })}
          >
            <Button
              size="sm"
              variant="secondary"
              className="w-fit"
              nativeButton={false}
              render={<a href={link.url} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink />
              {t('bots.settings.slack.openDm')}
            </Button>
          </SlackStep>
          <SlackStep n={2} label={t('bots.settings.slack.ownerStepSend')}>
            <CopyLine text={link.message} label={t('bots.settings.slack.copyCode')} />
          </SlackStep>
          <SlackStep n={3} label={t('bots.settings.slack.ownerStepCheck')}>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" className="w-fit" onClick={() => void refresh()}>
                {t('bots.settings.slack.check')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="w-fit"
                pending={ownerLink.isPending}
                onClick={() => ownerLink.mutate(account.id)}
              >
                {t('bots.settings.slack.newCode')}
              </Button>
            </div>
          </SlackStep>
        </ol>
      ) : (
        <Button
          size="sm"
          variant="primary"
          className="w-fit"
          pending={ownerLink.isPending}
          pendingLabel={t('bots.settings.slack.makingCode')}
          onClick={() => ownerLink.mutate(account.id)}
        >
          {t('bots.settings.slack.linkMe')}
        </Button>
      )}
    </div>
  );
}
