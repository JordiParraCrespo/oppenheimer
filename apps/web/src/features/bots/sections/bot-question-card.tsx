import {
  useAnswerBotQuestion,
  useBotPendingQuestion,
  useDismissBotQuestion,
} from '@oppenheimer/frontend-consumer/react';
import { ChatQuestionPicker, ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The questions a bot stopped on (`ask_user`, `25-bots.md` §3.2), a card of
 * their own beside the approval card, answered above the composer one at a
 * time with the same picker a session's questions use. Submit sends every
 * answer at once and Dismiss declines; either way the card goes and the bot
 * carries on in the chat. An answer that could not be sent starts the picker
 * over beside the error. It draws nothing while no card waits.
 */
export function BotQuestionCard({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: card, refetch } = useBotPendingQuestion(botId);
  // A card someone else settled (a second tab, a new message) is read again.
  const answer = useAnswerBotQuestion({ onError: () => void refetch() });
  const dismiss = useDismissBotQuestion({ onError: () => void refetch() });

  if (!card) return null;
  const failed = answer.error ?? dismiss.error;
  return (
    <div className="flex flex-col gap-2">
      <ChatQuestionPicker
        key={failed ? 'retry' : 'first'}
        questions={card.questions}
        onAnswer={(answers) => {
          answer.mutate({
            id: botId,
            questionId: card.id,
            answers: answers.map(({ picks, other }) => ({ picks: [...picks], other })),
          });
          return true;
        }}
        onDismiss={() => dismiss.mutate({ id: botId, questionId: card.id })}
      />
      <ErrorAlert
        error={failed}
        fallback={t('bots.chat.question.failed')}
        onDismiss={() => {
          answer.reset();
          dismiss.reset();
        }}
      />
    </div>
  );
}
