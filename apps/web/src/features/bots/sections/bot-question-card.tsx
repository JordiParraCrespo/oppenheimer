import type { BotApprovalEntity } from '@oppenheimer/frontend-consumer';
import { useDecideBotApproval } from '@oppenheimer/frontend-consumer/react';
import { ChatQuestionPicker, ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The questions a bot stopped on (`ask_user`, `25-bots.md` §3.2), answered
 * above the composer one at a time with the same picker a session's
 * questions use. Submit sends every answer at once and Dismiss declines;
 * either way the card goes and the bot carries on in the chat. An answer
 * that could not be sent starts the picker over beside the error.
 */
export function BotQuestionCard({
  botId,
  approval,
}: {
  botId: string;
  approval: BotApprovalEntity;
}) {
  const { t } = useTranslation();
  const decide = useDecideBotApproval();
  const answer = (
    decision: 'answer' | 'deny',
    answers?: { picks: number[]; other: string | null }[],
  ) => decide.mutate({ id: botId, approvalId: approval.id, decision, answers });

  return (
    <div className="flex flex-col gap-2">
      <ChatQuestionPicker
        key={decide.isError ? 'retry' : 'first'}
        questions={approval.questions}
        onAnswer={(answers) => {
          answer(
            'answer',
            answers.map(({ picks, other }) => ({ picks: [...picks], other })),
          );
          return true;
        }}
        onDismiss={() => answer('deny')}
      />
      <ErrorAlert
        error={decide.error}
        fallback={t('bots.chat.approval.failed')}
        onDismiss={() => decide.reset()}
      />
    </div>
  );
}
