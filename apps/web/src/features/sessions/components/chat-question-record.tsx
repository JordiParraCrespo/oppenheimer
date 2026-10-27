import { AnsweredQuestions, ChatMarker } from '@oppenheimer/design-system-web';
import { CircleStop, MessageCircleQuestion } from '@oppenheimer/design-system-web/icons';
import type { ChatToolCall } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';

/**
 * What the agent asked, as the transcript keeps it. While it waits, a quiet
 * line: the questions themselves are where the composer was, to be answered
 * there. Once answered, each question over what was picked; dismissed, a
 * note that says so.
 */
export function ChatQuestionRecord({ call }: { call: ChatToolCall }) {
  const { t } = useTranslation();
  if (call.status === 'running') {
    return (
      <ChatMarker icon={<MessageCircleQuestion />}>
        <span className="motion-safe:animate-shimmer">{t('sessions.chat.question.waiting')}</span>
      </ChatMarker>
    );
  }
  if (call.status === 'failed') {
    return <ChatMarker icon={<CircleStop />}>{t('sessions.chat.question.dismissed')}</ChatMarker>;
  }
  return (
    <AnsweredQuestions
      items={(call.questions ?? []).map((question) => ({
        question: question.question,
        answer: call.answers?.[question.question] ?? (
          <span className="text-fg-subtle">{t('sessions.chat.question.noAnswer')}</span>
        ),
      }))}
    />
  );
}
