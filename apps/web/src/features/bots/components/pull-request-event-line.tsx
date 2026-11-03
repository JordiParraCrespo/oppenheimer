import { TranscriptDivider } from '@oppenheimer/design-system-web';
import {
  CircleAlert,
  CircleCheck,
  GitMerge,
  GitPullRequest,
  MessageCircle,
} from '@oppenheimer/design-system-web/icons';
import type { BotPullRequestEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/** The line's words by what happened on the pull request. */
const PULL_REQUEST_KEYS = {
  check_failed: 'bots.chat.event.pullRequest.check_failed',
  check_passed: 'bots.chat.event.pullRequest.check_passed',
  review: 'bots.chat.event.pullRequest.review',
  comment: 'bots.chat.event.pullRequest.comment',
  pr_merged: 'bots.chat.event.pullRequest.pr_merged',
} as const;

const PULL_REQUEST_ICONS = {
  check_failed: <CircleAlert />,
  check_passed: <CircleCheck />,
  review: <GitPullRequest />,
  comment: <MessageCircle />,
  pr_merged: <GitMerge />,
} as const;

/**
 * A pull request the bot follows that woke it (`27-bot-subscriptions.md`
 * §7): "Pull request #128 of acme/app: checks failed", in red when a check
 * failed. Drawn from what GitHub's metadata said, never anyone's words.
 */
export function PullRequestEventLine({ event }: { event: BotPullRequestEvent }) {
  const { t } = useTranslation();
  const line = t(PULL_REQUEST_KEYS[event.event], {
    number: event.number,
    repository: event.repository,
  });
  return (
    <TranscriptDivider
      icon={PULL_REQUEST_ICONS[event.event]}
      tone={event.event === 'check_failed' ? 'danger' : 'default'}
    >
      <span className="max-w-xl truncate" title={line}>
        {line}
      </span>
    </TranscriptDivider>
  );
}
