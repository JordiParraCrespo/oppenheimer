import { Glass } from '@oppenheimer/design-system-mobile';
import { Icon } from '@oppenheimer/design-system-mobile/icon';
import { ArrowUp } from '@oppenheimer/design-system-mobile/icons';
import { Text } from '@oppenheimer/design-system-mobile/text';
import { approvalDecisionLooks } from '@oppenheimer/frontend-consumer';
import {
  useAnswerBotQuestion,
  useBotPendingApproval,
  useBotPendingQuestion,
  useDecideBotApproval,
  useSendBotMessage,
} from '@oppenheimer/frontend-consumer/react';
import { useQuestionStepper } from '@oppenheimer/frontend-mobile';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';
import { ApprovalCard } from '../components/approval-card';
import { QuestionCard } from '../components/question-card';
import { approvalDetail } from '../lib/approval-detail';

const NO_QUESTIONS: readonly never[] = [];

/**
 * The glass at the foot of a bot's chat: the card it waits on (an approval,
 * answered with the decisions the API offers, or a question), then the
 * message field. A message sent while a turn works waits for it, as the
 * console's Enter does.
 */
export function BotDock({
  botId,
  botName,
  onHeight,
}: {
  botId: string;
  botName: string;
  onHeight: (height: number) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const approval = useBotPendingApproval(botId);
  const question = useBotPendingQuestion(botId);
  const decide = useDecideBotApproval();
  const answer = useAnswerBotQuestion();
  const send = useSendBotMessage();
  const card = approval.data ?? null;
  const asked = card ? null : (question.data ?? null);
  const stepper = useQuestionStepper(asked?.id ?? '', asked?.questions ?? NO_QUESTIONS, (picks) => {
    if (!asked) return;
    answer.mutate({
      id: botId,
      questionId: asked.id,
      answers: picks.map((chosen) => ({ picks: chosen, other: null })),
    });
  });
  const part = asked?.questions[stepper.step];
  const sendDraft = () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    // A refused send gives its words back, unless something new was typed since.
    send.mutate(
      { id: botId, content },
      { onError: () => setDraft((typed) => (typed.trim() ? typed : content)) },
    );
  };

  return (
    <View
      className="absolute inset-x-0 bottom-0 px-3 pb-3"
      onLayout={(event) => onHeight(event.nativeEvent.layout.height)}
      pointerEvents="box-none"
    >
      <Glass className="gap-3 rounded-[28px] pb-3">
        {card ? (
          <ApprovalCard
            tool={card.tool}
            summary={card.summary}
            detail={approvalDetail(card.details.input)}
            looks={approvalDecisionLooks(card.details.decisions)}
            pending={decide.isPending}
            error={decide.isError ? t('bots.mobile.decideFailed') : null}
            labels={{
              needsApproval: t('sessions.mobile.needsApproval'),
              decision: (look) =>
                look.label === 'alwaysFor'
                  ? t('bots.chat.approval.alwaysFor', { subject: card.details.subjectLabel ?? '' })
                  : t(`bots.chat.approval.${look.label}`),
            }}
            onDecide={(decision) => decide.mutate({ id: botId, approvalId: card.id, decision })}
          />
        ) : null}
        {asked && part ? (
          <QuestionCard
            question={part}
            picked={stepper.picked}
            pending={answer.isPending}
            error={answer.isError ? t('bots.mobile.answerFailed') : null}
            labels={{
              needsInput: t('bots.chat.approval.needsInput'),
              send: t('inbox.session.send'),
              sending: t('inbox.session.sending'),
            }}
            onPick={stepper.pick}
            onSend={stepper.send}
          />
        ) : null}
        <View
          className={
            card || asked
              ? 'flex-row items-center gap-2 px-3'
              : 'flex-row items-center gap-2 px-3 pt-3'
          }
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t('bots.chat.placeholders.anything', { name: botName })}
            accessibilityLabel={t('bots.chat.field', { name: botName })}
            multiline
            className="max-h-32 min-h-11 flex-1 rounded-[22px] bg-secondary px-4 py-3 text-[15px] text-foreground placeholder:text-ink-400"
          />
          <Pressable
            onPress={sendDraft}
            disabled={!draft.trim() || send.isPending}
            accessibilityRole="button"
            accessibilityLabel={t('bots.chat.send')}
            className="size-11 items-center justify-center rounded-full bg-primary active:opacity-80 disabled:opacity-40"
          >
            <Icon as={ArrowUp} size={20} className="text-primary-foreground" />
          </Pressable>
        </View>
        {send.isError ? (
          <Text variant="caption" tone="destructive" className="px-4">
            {t('bots.chat.sendFailed')}
          </Text>
        ) : null}
      </Glass>
    </View>
  );
}
