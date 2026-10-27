import {
  Button,
  DiffStat,
  InboxCard,
  InboxCardActions,
  InboxCardBody,
  InboxCardFacts,
  StatusDot,
  type StatusState,
} from '@oppenheimer/design-system-web';
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
 * A pull request in the pane: its checks and size, Review (it opens in Pull
 * requests) and, while nothing holds it, Merge through the existing merge
 * endpoint. A merge GitHub refuses stays on the card, in its words.
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
    <InboxCard icon={<InboxKindIcon kind="pull" />} from={from} title={copy.title} age={age}>
      <InboxCardBody>{copy.body}</InboxCardBody>
      <InboxCardFacts>
        <StatusDot state={CHECKS_GATE[pull.checks] ?? 'waiting'} density="compact">
          {t(`inbox.pull.checks.${pull.checks}`)}
        </StatusDot>
        <DiffStat additions={pull.additions} deletions={pull.deletions} />
        <span>{pull.reference}</span>
      </InboxCardFacts>
      {merge.error ? (
        <ErrorAlert
          error={merge.error}
          fallback={t('inbox.card.answerFailed')}
          onDismiss={merge.reset}
        />
      ) : null}
      <InboxCardActions
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
              {t('inbox.pull.review')}
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
                    inboxVisit.log(
                      t('inbox.log.merged', { number: pull.number, repository: pull.repository }),
                    );
                  },
                },
              )
            }
          >
            {t('inbox.pull.merge')}
          </Button>
        ) : null}
      </InboxCardActions>
    </InboxCard>
  );
}
