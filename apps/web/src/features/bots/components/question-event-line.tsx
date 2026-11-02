import { AnsweredQuestions, TranscriptDivider } from '@oppenheimer/design-system-web';
import { Check, X } from '@oppenheimer/design-system-web/icons';
import type { BotQuestionEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * A decided card of questions as a trace line: answered with a check and
 * each question over its answer, dismissed with a plain cross.
 */
export function QuestionEventLine({ event }: { event: BotQuestionEvent }) {
  const { t } = useTranslation();
  const answered = event.outcome === 'answered';
  return (
    <>
      <TranscriptDivider icon={answered ? <Check /> : <X />}>
        <span className="max-w-xl truncate" title={event.summary}>
          {t(`bots.chat.question.${event.outcome}`, { summary: event.summary })}
        </span>
      </TranscriptDivider>
      {event.answers.length > 0 ? <AnsweredQuestions items={event.answers} /> : null}
    </>
  );
}
