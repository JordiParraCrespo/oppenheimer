import { Button, QuestionPanel, Textarea } from '@oppenheimer/design-system-web';
import type { ChatAnswer } from '@oppenheimer/shared/sessions';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** A question the picker asks: the shape of Claude Code's `AskUserQuestion`, which a bot's `ask_user` shares. */
export interface ChatPickerQuestion {
  /** The tag over it ("Scope"). */
  header: string | null;
  question: string;
  /** Several options may be picked. */
  multiSelect: boolean;
  options: readonly { label: string; description: string | null }[];
}

const UNANSWERED: ChatAnswer = { picks: [], other: null };

const answered = (answer: ChatAnswer | undefined) =>
  Boolean(answer && (answer.picks.length > 0 || answer.other?.trim()));

/**
 * The questions an agent stopped on (a session's `AskUserQuestion`, a bot's
 * `ask_user`), answered where the composer was, one at a time, as Claude
 * Code's terminal picker asks them, each under
 * the agent's tag for it. Focus lands on the first option as the panel
 * appears, so an option is picked by its number at once, or by its row;
 * where the agent allows several, each toggles. The person may answer in
 * their own words instead (one choice) or as well (several), and Enter in
 * the field moves on. Picking the one choice moves on to the next question;
 * a lone question of one choice is answered by the pick itself, as the
 * picker does. Otherwise the last one is sent with Submit, all answers
 * together, and Dismiss is Escape, which the agent reads as declining.
 * Nothing reaches the agent until then, so moving back and forth changes
 * nothing there. `onAnswer` says whether the answers went; when they could
 * not, the panel stays to be sent again.
 */
export function ChatQuestionPicker({
  questions,
  onAnswer,
  onDismiss,
}: {
  questions: readonly ChatPickerQuestion[];
  onAnswer: (answers: ChatAnswer[]) => boolean;
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
  const ready = answers.every(answered);

  const update = (next: ChatAnswer) => {
    const held = answers.map((current, i) => (i === index ? next : current));
    setAnswers(held);
    return held;
  };

  function submit(held: ChatAnswer[]) {
    if (sent || !held.every(answered)) return;
    setSent(onAnswer(held));
  }

  function pick(option: number) {
    if (sent) return;
    if (question?.multiSelect) {
      const picks = answer.picks.includes(option)
        ? answer.picks.filter((kept) => kept !== option)
        : [...answer.picks, option].sort((a, b) => a - b);
      update({ ...answer, picks });
      return;
    }
    const held = update({ picks: [option], other: null });
    if (!last) setIndex(index + 1);
    else if (questions.length === 1) submit(held);
  }

  function goOn() {
    if (!answered(answer)) return;
    if (last) submit(answers);
    else setIndex(index + 1);
  }

  return (
    <QuestionPanel
      autoFocus
      header={question.header ?? undefined}
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
        previous: t('common.chat.question.previous'),
        next: t('common.chat.question.nextQuestion'),
        of: (n, total) => t('common.chat.question.of', { n, total }),
      }}
      answer={
        <Textarea
          rows={1}
          value={answer.other ?? ''}
          disabled={sent}
          onChange={(event) => {
            const other = event.target.value;
            // One choice is the option or the words, never both.
            update({ picks: question.multiSelect ? answer.picks : [], other });
          }}
          onKeyDown={(event) => {
            // The words go to the picker on one line, so Enter is never a newline here.
            if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
            event.preventDefault();
            goOn();
          }}
          placeholder={t('common.chat.question.ownAnswer')}
          aria-label={t('common.chat.question.ownAnswerLabel')}
        />
      }
      foot={
        <>
          <span className="flex-1">
            {sent
              ? t('common.chat.question.sending')
              : t(
                  question.multiSelect
                    ? 'common.chat.question.several'
                    : 'common.chat.question.one',
                  { last: question.options.length },
                )}
          </span>
          <Button variant="ghost" size="sm" disabled={sent} onClick={onDismiss}>
            {t('common.chat.question.dismiss')}
          </Button>
          {last ? (
            <Button
              size="sm"
              disabled={!ready}
              pending={sent}
              pendingLabel={t('common.chat.question.sending')}
              onClick={() => submit(answers)}
            >
              {t('common.chat.question.submit')}
            </Button>
          ) : (
            <Button size="sm" disabled={!answered(answer)} onClick={goOn}>
              {t('common.chat.question.next')}
            </Button>
          )}
        </>
      }
    />
  );
}
