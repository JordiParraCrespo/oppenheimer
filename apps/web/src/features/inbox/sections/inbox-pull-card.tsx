import {
  Button,
  DiffStat,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
  InboxMessageFacts,
  StatusDot,
  type StatusState,
} from '@oppenheimer/design-system-web';
import { SquareArrowOutUpRight } from '@oppenheimer/design-system-web/icons';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useMergePullRequest } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';
import { InboxLaterButton } from '@/features/inbox/sections/inbox-later-button';

/** The checks as a gate: passing, blocked, or still to be known. */
const CHECKS_GATE: Record<string, StatusState> = {
  passing: 'passing',
  failing: 'blocked',
  running: 'waiting',
  none: 'waiting',
  unavailable: 'waiting',
};

/**
 * A pull request in the reading pane, from its author: its checks and size, Open (it opens in Pull
 * requests), View on GitHub (a new tab) and, while nothing holds it, Merge
 * through the existing merge endpoint. A merge GitHub refuses stays on the
 * card, in its words.
 */
export function InboxPullCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'pull' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const merge = useMergePullRequest();
  const { pull } = item;

  return (
    <InboxMessage
      icon={<InboxKindIcon kind="pull" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      <InboxMessageBody>{copy.body}</InboxMessageBody>
      <InboxMessageFacts>
        <StatusDot state={CHECKS_GATE[pull.checks] ?? 'waiting'} density="compact">
          {t(`inbox.pull.checks.${pull.checks}`)}
        </StatusDot>
        <DiffStat additions={pull.additions} deletions={pull.deletions} />
        <span>{pull.reference}</span>
      </InboxMessageFacts>
      {merge.error ? (
        <ErrorAlert
          error={merge.error}
          fallback={t('inbox.card.answerFailed')}
          onDismiss={merge.reset}
        />
      ) : null}
      <InboxMessageActions
        leading={
          <>
            <InboxLaterButton itemKey={item.key} />
            <Button
              variant="secondary"
              render={
                <Link
                  to="/pulls/$installationId/$githubRepoId/$number"
                  params={{
                    installationId: pull.installationId,
                    githubRepoId: String(pull.githubRepoId),
                    number: String(pull.number),
                  }}
                />
              }
            >
              {t('inbox.pull.open')}
            </Button>
            <Button
              variant="ghost"
              render={<a href={pull.htmlUrl} target="_blank" rel="noreferrer" />}
            >
              <SquareArrowOutUpRight />
              {t('inbox.pull.viewOnGithub')}
            </Button>
          </>
        }
      >
        {pull.canMerge ? (
          <Button
            disabled={merge.isPending}
            onClick={() =>
              merge.mutate(
                { address: pull.address },
                {
                  onSuccess: () => {
                    inboxVisit.answered(item.key);
                  },
                },
              )
            }
          >
            {t('inbox.pull.merge')}
          </Button>
        ) : null}
      </InboxMessageActions>
    </InboxMessage>
  );
}
