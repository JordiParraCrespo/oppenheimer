import {
  AgentMark,
  Button,
  InboxMessage,
  InboxMessageActions,
  InboxMessageBody,
  InboxMessageFacts,
} from '@oppenheimer/design-system-web';
import { type InboxItem, sessionAgentLabel } from '@oppenheimer/frontend-consumer';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InboxKindIcon } from '@/features/inbox/components/inbox-kind-icon';
import { InboxPermissionAnswer } from '@/features/inbox/components/inbox-permission-answer';
import { InboxQuestionAnswer } from '@/features/inbox/components/inbox-question-answer';
import { useAnswerDecision } from '@/features/inbox/hooks/use-answer-decision';
import { toAnswers } from '@/features/inbox/lib/inbox-answer';
import type { InboxCopy } from '@/features/inbox/lib/inbox-copy';
import { InboxSessionFailure } from '@/features/inbox/sections/inbox-session-failure';

/**
 * A session waiting on you, in the pane. What its agent waits on, when the
 * host could read it, is answered here: a permission dialog by one of its
 * options, a questionnaire one question at a time, then Send. Open session is
 * the last answer on each, to answer in the terminal instead. A failed launch
 * says why it failed, as its page does; otherwise the answer is Open
 * session. A session whose agent waits has no Done on the dock: only an
 * answer takes it off the deck.
 *
 * The card stays mounted for the session while its decision changes (the
 * pane keys it by session), so an answer refused as stale keeps its error
 * over the decision the session now waits on; each decision's own picks
 * start afresh (keyed by its id).
 */
export function InboxSessionCard({
  item,
  copy,
  from,
  age,
}: {
  item: Extract<InboxItem, { kind: 'session' }>;
  copy: InboxCopy;
  from: string;
  age: string;
}) {
  const { t } = useTranslation();
  const answer = useAnswerDecision(item);
  const { session } = item;
  const { decision } = session;

  const open = (variant: 'primary' | 'secondary') => (
    <Button
      variant={variant}
      render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
    >
      {t('inbox.session.open')}
    </Button>
  );
  const alert = answer.error ? (
    <ErrorAlert
      error={answer.error}
      fallback={t('inbox.session.answerFailed')}
      onDismiss={answer.reset}
    />
  ) : null;

  return (
    <InboxMessage
      icon={<InboxKindIcon kind="session" />}
      sender={copy.sender}
      meta={from}
      title={copy.title}
      age={age}
    >
      {session.lifecycle === 'failed' ? (
        <InboxSessionFailure session={session} fallback={copy.body} />
      ) : (
        <InboxMessageBody>{copy.body}</InboxMessageBody>
      )}
      <InboxMessageFacts>
        <span className="flex items-center gap-1.5 [&_svg]:size-3.5">
          <AgentMark agent={session.agent} />
          {sessionAgentLabel(session.agent)}
        </span>
        {session.scopeLabel && !decision ? (
          <span className="font-mono">{session.scopeLabel}</span>
        ) : null}
      </InboxMessageFacts>
      {decision?.kind === 'permission' ? (
        <>
          <InboxPermissionAnswer
            key={decision.id}
            decision={decision}
            pending={answer.pending}
            onChoose={(option) => answer.send({ id: decision.id, option })}
          />
          {alert}
          <InboxMessageActions>{open('secondary')}</InboxMessageActions>
        </>
      ) : decision?.kind === 'question' ? (
        <InboxQuestionAnswer
          key={decision.id}
          decision={decision}
          pending={answer.pending}
          onSend={(answers) => answer.send({ id: decision.id, answers: toAnswers(answers) })}
          alert={alert}
          open={open('secondary')}
        />
      ) : (
        <>
          {alert}
          <InboxMessageActions>{open('primary')}</InboxMessageActions>
        </>
      )}
    </InboxMessage>
  );
}
