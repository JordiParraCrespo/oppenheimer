import { Button, QuestionPanel, Textarea } from '@oppenheimer/design-system-web';
import type { ChatAnswer, ChatQuestion } from '@oppenheimer/frontend-consumer';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const UNANSWERED: ChatAnswer = { picks: [], other: null };

const answered = (answer: ChatAnswer | undefined) =>
  Boolean(answer && (answer.picks.length > 0 || answer.other?.trim()));

/**
 * The questions the agent stopped on (`AskUserQuestion`), answered where the
 * composer was, one at a time, as its terminal picker asks them. An option
 * is picked by its row or its number; where the agent allows several, each
 * toggles. The person may answer in their own words instead (one choice) or
 * as well (several). Picking the one choice moves on to the next question;
 * the last one is sent with Submit, all answers together, and Dismiss is
 * Escape, which the agent reads as declining. Nothing reaches the agent
 * until Submit, so moving back and forth changes nothing there.
 */
export function SessionChatQuestion({
  questions,
  onAnswer,
  onDismiss,
}: {
  questions: readonly ChatQuestion[];
  onAnswer: (answers: ChatAnswer[]) => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<ChatAnswer[]>(() => questions.map(() => UNANSWERED));
  const [sent, setSent] = useState(false);
  const question = questions[index];
  if (!question) return null;
  const answer = answers[index] ?? UNANSWERED;
  const last = index === questions.length - 1;

  const update = (next: ChatAnswer) =>
    setAnswers((held) => held.map((current, i) => (i === index ? next : current)));

  function pick(option: number) {
    if (question?.multiSelect) {
      const picks = answer.picks.includes(option)
        ? answer.picks.filter((held) => held !== option)
        : [...answer.picks, option].sort((a, b) => a - b);
      update({ ...answer, picks });
      return;
    }
    update({ picks: [option], other: null });
    if (!last) setIndex(index + 1);
  }

  return (
    <QuestionPanel
      question={question.question}
      options={question.options.map((option) => ({
        label: option.label,
        description: option.description ?? undefined,
      }))}
      value={question.multiSelect ? answer.picks : (answer.picks[0] ?? null)}
      onValueChange={pick}
      index={index}
      total={questions.length}
      onPrevious={() => setIndex(index - 1)}
      onNext={() => setIndex(index + 1)}
      labels={{
        previous: t('sessions.chat.question.previous'),
        next: t('sessions.chat.question.nextQuestion'),
        of: (n, total) => t('sessions.chat.question.of', { n, total }),
      }}
      answer={
        <Textarea
          rows={1}
          value={answer.other ?? ''}
          onChange={(event) => {
            const other = event.target.value;
            // One choice is the option or the words, never both.
            update({ picks: question.multiSelect ? answer.picks : [], other });
          }}
          placeholder={t('sessions.chat.question.ownAnswer')}
          aria-label={t('sessions.chat.question.ownAnswerLabel')}
        />
      }
      foot={
        <>
          <span className="flex-1">
            {sent
              ? t('sessions.chat.question.sending')
              : t(
                  question.multiSelect
                    ? 'sessions.chat.question.several'
                    : 'sessions.chat.question.one',
                )}
          </span>
          <Button variant="ghost" size="sm" disabled={sent} onClick={onDismiss}>
            {t('sessions.chat.question.dismiss')}
          </Button>
          {last ? (
            <Button
              size="sm"
              disabled={!answers.every(answered)}
              pending={sent}
              pendingLabel={t('sessions.chat.question.sending')}
              onClick={() => {
                setSent(true);
                onAnswer(answers);
              }}
            >
              {t('sessions.chat.question.submit')}
            </Button>
          ) : (
            <Button size="sm" disabled={!answered(answer)} onClick={() => setIndex(index + 1)}>
              {t('sessions.chat.question.next')}
            </Button>
          )}
        </>
      }
    />
  );
}
