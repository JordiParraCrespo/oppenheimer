import {
  ComposerNotice,
  ComposerStack,
  ComposerStackAction,
  ComposerStackRow,
} from '@oppenheimer/design-system-web';
import { KeyRound, SquareSlash } from '@oppenheimer/design-system-web/icons';
import type { BotWaitingMessage } from '@oppenheimer/frontend-consumer';
import {
  useBotGoal,
  useBotLoop,
  useBotWaitingMessages,
} from '@oppenheimer/frontend-consumer/react';
import { ChatQueuedRow } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComposerTop } from '@/features/bots/lib/composer-top';
import { BotGoalNotice } from '@/features/bots/sections/bot-goal-notice';
import { BotLoopNotice } from '@/features/bots/sections/bot-loop-notice';

/**
 * What sits on the bot composer's top edge (`ChatComposer`'s `above`), the
 * one surface `composerTopOf` picked: the messages waiting their turn (with
 * the missing key on top of them), the missing key, what a typed built-in
 * lacks, the goal, or the loop. One entry per surface, so the next is an
 * entry here and the composer only says which. The composer keeps what its
 * own controls act on (the cancel, a message taken back into the field).
 */
export function BotComposerTop({
  botId,
  top,
  runningTurnId,
  noKey,
  notice,
  onAddKey,
  onCancel,
  onTakeBack,
}: {
  botId: string;
  top: ComposerTop;
  /** The turn under way, which Send now stops; null when none runs. */
  runningTurnId: string | null;
  noKey: string | undefined;
  notice: string | undefined;
  onAddKey: () => void;
  onCancel: (turnId: string) => void;
  onTakeBack: (message: BotWaitingMessage) => void;
}) {
  const { t } = useTranslation();
  const waiting = useBotWaitingMessages(botId);
  const { data: goal } = useBotGoal(botId);
  const { data: loop } = useBotLoop(botId);
  const addKey = (
    <ComposerStackAction onClick={onAddKey}>{t('bots.chat.addKey')}</ComposerStackAction>
  );
  const tops: Record<ComposerTop, () => ReactNode> = {
    queue: () => (
      <ComposerStack>
        {noKey ? (
          <ComposerStackRow icon={<KeyRound />} actions={addKey}>
            {noKey}
          </ComposerStackRow>
        ) : null}
        {waiting.map((message, index) => (
          <ChatQueuedRow
            key={message.turnId}
            steer={message.steer}
            text={message.text || t('bots.chat.queuedImages', { count: message.images })}
            onSendNow={index === 0 && runningTurnId ? () => onCancel(runningTurnId) : undefined}
            onEdit={message.images === 0 ? () => onTakeBack(message) : undefined}
            onRemove={() => onCancel(message.turnId)}
          />
        ))}
      </ComposerStack>
    ),
    noKey: () => (
      <ComposerNotice icon={<KeyRound />} action={addKey}>
        {noKey}
      </ComposerNotice>
    ),
    command: () => <ComposerNotice icon={<SquareSlash />}>{notice}</ComposerNotice>,
    goal: () => (goal ? <BotGoalNotice botId={botId} goal={goal} /> : null),
    loop: () => (loop ? <BotLoopNotice botId={botId} loop={loop} /> : null),
  };
  return tops[top]();
}
