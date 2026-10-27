import {
  InboxQuestion,
  InboxQuestionOption,
  InboxQuestionOptions,
  Input,
} from '@oppenheimer/design-system-web';
import type { SessionDecisionQuestion } from '@oppenheimer/shared/schemas/session-decision';
import { useTranslation } from 'react-i18next';
import type { InboxAnswer } from '@/features/inbox/lib/inbox-answer';

/**
 * One question on the card: numbered, under its tag, its options as pills
 * (one, or several where the agent allows it), and a field for an answer of
 * the reader's own. Words replace the pick of a single choice, and a pick
 * replaces the words; beside several picks the words are one more answer.
 */
export function InboxQuestionField({
  n,
  question,
  answer,
  disabled,
  onChange,
}: {
  n: number;
  question: SessionDecisionQuestion;
  answer: InboxAnswer;
  disabled: boolean;
  onChange: (answer: InboxAnswer) => void;
}) {
  const { t } = useTranslation();

  return (
    <InboxQuestion n={n} header={question.header ?? undefined} question={question.question}>
      <InboxQuestionOptions
        multiple={question.multiSelect}
        value={answer.picks}
        disabled={disabled}
        aria-label={t('inbox.session.optionsLabel', { n })}
        onValueChange={(picks) =>
          onChange({ picks, other: question.multiSelect ? answer.other : '' })
        }
      >
        {question.options.map((option, index) => (
          <InboxQuestionOption
            // biome-ignore lint/suspicious/noArrayIndexKey: an option is answered by its place.
            key={index}
            index={index}
            label={option.label}
            description={option.description ?? undefined}
          />
        ))}
      </InboxQuestionOptions>
      <Input
        size="sm"
        value={answer.other}
        disabled={disabled}
        placeholder={t('inbox.session.other')}
        aria-label={t('inbox.session.otherLabel', { n })}
        onChange={(event) =>
          onChange({
            picks: question.multiSelect ? answer.picks : [],
            other: event.target.value,
          })
        }
      />
    </InboxQuestion>
  );
}
