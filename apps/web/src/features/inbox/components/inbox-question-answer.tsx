import { Button, InboxCardActions, InboxQuestions } from '@oppenheimer/design-system-web';
import type { SessionQuestionDecision } from '@oppenheimer/shared/schemas/session-decision';
import type * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxQuestionField } from '@/features/inbox/components/inbox-question-field';
import { type InboxAnswer, isAnswered, UNANSWERED } from '@/features/inbox/lib/inbox-answer';

/**
 * A question the agent asked (`AskUserQuestion`), answered on the card: every
 * question at once, numbered, and Send answers once each has an answer.
 * Nothing reaches the agent until then. `alert` sits over the answer row,
 * `leading` is that row's left side (Later, Open session).
 */
export function InboxQuestionAnswer({
  decision,
  pending,
  onSend,
  alert,
  leading,
}: {
  decision: SessionQuestionDecision;
  pending: boolean;
  onSend: (answers: InboxAnswer[]) => void;
  alert: React.ReactNode;
  leading: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<InboxAnswer[]>(() =>
    decision.questions.map(() => UNANSWERED),
  );
  const ready = answers.every(isAnswered);

  return (
    <>
      <InboxQuestions>
        {decision.questions.map((question, index) => (
          <InboxQuestionField
            // biome-ignore lint/suspicious/noArrayIndexKey: a question is answered by its place.
            key={index}
            n={index + 1}
            question={question}
            answer={answers[index] ?? UNANSWERED}
            disabled={pending}
            onChange={(next) =>
              setAnswers(answers.map((current, i) => (i === index ? next : current)))
            }
          />
        ))}
      </InboxQuestions>
      {alert}
      <InboxCardActions leading={leading}>
        <Button
          disabled={!ready}
          pending={pending}
          pendingLabel={t('inbox.session.sending')}
          onClick={() => onSend(answers)}
        >
          {t('inbox.session.send')}
        </Button>
      </InboxCardActions>
    </>
  );
}
