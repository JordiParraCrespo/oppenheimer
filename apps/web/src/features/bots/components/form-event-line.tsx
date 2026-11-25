import { AnsweredQuestions, TranscriptDivider } from '@oppenheimer/design-system-web';
import { ClipboardCheck, X } from '@oppenheimer/design-system-web/icons';
import type { BotFormEvent } from '@oppenheimer/shared/schemas/bot';
import { useTranslation } from 'react-i18next';

/**
 * A decided form as a trace line, the compact record of what was sent:
 * submitted with each field's label over its value (a muted "Left blank"
 * for one left empty), dismissed with a plain cross.
 */
export function FormEventLine({ event }: { event: BotFormEvent }) {
  const { t } = useTranslation();
  const submitted = event.outcome === 'submitted';
  return (
    <>
      <TranscriptDivider icon={submitted ? <ClipboardCheck /> : <X />}>
        <span className="max-w-xl truncate" title={event.title}>
          {t(`bots.chat.form.${event.outcome}`, { title: event.title })}
        </span>
      </TranscriptDivider>
      {event.values.length > 0 ? (
        <AnsweredQuestions
          items={event.values.map(({ label, value }) => ({
            question: label,
            answer: value ? (
              <span className="whitespace-pre-wrap break-words">{value}</span>
            ) : (
              <span className="italic text-fg-subtle">{t('bots.chat.form.blank')}</span>
            ),
          }))}
        />
      ) : null}
    </>
  );
}
