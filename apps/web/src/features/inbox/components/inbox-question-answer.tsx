import {
  Button,
  InboxAnswerSummary,
  InboxMessageActions,
  InboxQuestionSteps,
} from '@oppenheimer/design-system-web';
import type { SessionQuestionDecision } from '@oppenheimer/shared/schemas/session-decision';
import type * as React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InboxQuestionField } from '@/features/inbox/components/inbox-question-field';
import { type InboxAnswer, isAnswered, UNANSWERED } from '@/features/inbox/lib/inbox-answer';

/**
 * A questionnaire the agent sent (`AskUserQuestion`), answered on the card one
 * question at a time, as a deck within the card: picking the one answer of a
 * question moves on to the next; a question of several picks, one answered in
 * the reader's own words, or one already answered and come back to (Back, a
 * review row) moves on with Next. After the last, every answer
 * in a list, each a way back to its question, and Send answers; nothing
 * reaches the agent until then. `alert` sits over the answers, `open` (Open
 * session) is the last of them.
 */
export function InboxQuestionAnswer({
  decision,
  pending,
  onSend,
  alert,
  open,
}: {
  decision: SessionQuestionDecision;
  pending: boolean;
  onSend: (answers: InboxAnswer[]) => void;
  alert: React.ReactNode;
  open: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { questions } = decision;
  const [answers, setAnswers] = useState<InboxAnswer[]>(() => questions.map(() => UNANSWERED));
  const [step, setStep] = useState(0);
  const reviewing = step >= questions.length;
  const question = questions[step];
  const answer = answers[step] ?? UNANSWERED;
  const ready = answers.every(isAnswered);

  const answerWith = (next: InboxAnswer) => {
    setAnswers(answers.map((current, index) => (index === step ? next : current)));
    // One pick of a single choice is the whole answer: on to the next question.
    if (question && !question.multiSelect && next.picks.length === 1 && !next.other.trim()) {
      setStep(step + 1);
    }
  };
  const said = (index: number) => {
    const given = answers[index] ?? UNANSWERED;
    const picked = given.picks.map((pick) => questions[index]?.options[pick]?.label ?? '');
    return [...picked, given.other.trim()].filter(Boolean).join(', ');
  };

  return (
    <>
      <InboxQuestionSteps
        total={questions.length}
        current={step}
        label={
          reviewing
            ? t('inbox.question.ready')
            : t('inbox.question.step', { n: step + 1, total: questions.length })
        }
        action={
          step > 0 ? (
            <Button variant="ghost" size="xs" onClick={() => setStep(step - 1)}>
              {t('inbox.question.back')}
            </Button>
          ) : null
        }
      />
      {question ? (
        <InboxQuestionField
          key={step}
          n={step + 1}
          question={question}
          answer={answer}
          disabled={pending}
          onChange={answerWith}
        />
      ) : (
        <InboxAnswerSummary
          rows={questions.map((asked, index) => ({
            label: asked.header ?? t('inbox.question.label', { n: index + 1 }),
            answer: said(index),
            editLabel: t('inbox.question.edit', { question: asked.question }),
            onEdit: () => setStep(index),
          }))}
        />
      )}
      {alert}
      <InboxMessageActions>
        {reviewing ? (
          <Button
            disabled={!ready}
            pending={pending}
            pendingLabel={t('inbox.session.sending')}
            onClick={() => onSend(answers)}
          >
            {t('inbox.session.send')}
          </Button>
        ) : question && (question.multiSelect || isAnswered(answer)) ? (
          <Button disabled={!isAnswered(answer)} onClick={() => setStep(step + 1)}>
            {t('inbox.question.next')}
          </Button>
        ) : null}
        {open}
      </InboxMessageActions>
    </>
  );
}
