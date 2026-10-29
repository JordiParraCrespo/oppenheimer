import {
  ApprovalCommand,
  Button,
  InboxCard,
  InboxCardActions,
  InboxCardBody,
  InboxCardFacts,
} from '@oppenheimer/design-system-web';
import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { useDecideBotApproval } from '@oppenheimer/frontend-consumer/react';
import { ChatMailMessage, ChatMailSendNote, ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { formatApprovalInput } from '@/features/inbox/lib/approval-input';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { inboxVisit } from '@/features/inbox/lib/inbox-visit';
import { InboxLaterButton } from '@/features/inbox/sections/inbox-later-button';

/**
 * A bot's approval in the pane: what it wants to run (the tool, and its call's
 * input in mono, as the session card shows a command, or a send card's message
 * as it will go), and Approve or Deny through the bot's own decision endpoint
 * (`25-bots.md` §5). Answering logs it and brings the next item; the bot's
 * chat is a link away.
 */
export function InboxApprovalCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'approval' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const decide = useDecideBotApproval();
  const { approval } = item;
  const call = formatApprovalInput(approval.input);
  // The decision whose request is in flight: its button says so, the other waits.
  const inFlight = decide.isPending ? (decide.variables?.decision ?? null) : null;
  const answer = (decision: 'approve' | 'deny') =>
    decide.mutate(
      { id: approval.botId, approvalId: approval.id, decision },
      {
        onSuccess: () => {
          inboxVisit.answered(item.key);
          inboxVisit.log(
            t(decision === 'approve' ? 'inbox.log.approved' : 'inbox.log.denied', {
              bot: approval.botName,
              tool: approval.tool,
            }),
          );
        },
      },
    );

  return (
    <InboxCard icon={<InboxKindIcon kind="approval" />} from={from} title={copy.title} age={age}>
      <InboxCardBody>{copy.body}</InboxCardBody>
      <InboxCardFacts>
        <span className="font-mono">{approval.tool}</span>
      </InboxCardFacts>
      {approval.mail ? (
        <ChatMailMessage mail={approval.mail}>
          <ChatMailSendNote mail={approval.mail} />
        </ChatMailMessage>
      ) : call ? (
        <ApprovalCommand>{call}</ApprovalCommand>
      ) : null}
      {decide.error ? (
        <ErrorAlert
          error={decide.error}
          fallback={t('inbox.card.answerFailed')}
          onDismiss={decide.reset}
        />
      ) : null}
      <InboxCardActions
        leading={
          <>
            <InboxLaterButton itemKey={item.key} />
            <Button
              variant="secondary"
              render={<Link to="/bots/$botId" params={{ botId: approval.botId }} />}
            >
              {t('inbox.approval.openChat')}
            </Button>
          </>
        }
      >
        <Button
          variant="secondary"
          pending={inFlight === 'deny'}
          pendingLabel={t('inbox.approval.denying')}
          disabled={inFlight !== null}
          onClick={() => answer('deny')}
        >
          {t('inbox.approval.deny')}
        </Button>
        <Button
          pending={inFlight === 'approve'}
          pendingLabel={t('inbox.approval.approving')}
          disabled={inFlight !== null}
          onClick={() => answer('approve')}
        >
          {t('inbox.approval.approve')}
        </Button>
      </InboxCardActions>
    </InboxCard>
  );
}
