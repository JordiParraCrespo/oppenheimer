import { Button } from '@oppenheimer/design-system-web';
import type { BotEntity } from '@oppenheimer/frontend-consumer';
import { useRouteWhatsappChats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChatAnswerPicker } from '@/features/whatsapp/components/chat-answer-picker';
import { answerOf } from '@/features/whatsapp/lib/chat-filter';

/**
 * What to do with the ticked chats: answer them all with one bot (or the
 * number's default), or stop answering them. On success the ticks clear; on
 * a failure they stay, with why.
 */
export function WhatsappChatsBulk({
  accountId,
  chatIds,
  bots,
  defaultBotName,
  onDone,
}: {
  accountId: string;
  chatIds: readonly string[];
  bots: readonly BotEntity[];
  defaultBotName: string | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [answer, setAnswer] = useState('default');
  const route = useRouteWhatsappChats({ onSuccess: onDone });

  return (
    <section
      aria-label={t('settings.whatsapp.chats.bulkLabel')}
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface-card px-3 py-2"
    >
      <span className="text-sm font-medium text-fg">
        {t('settings.whatsapp.chats.selected', { count: chatIds.length })}
      </span>
      <span className="text-sm text-fg-muted">{t('settings.whatsapp.chats.answerWith')}</span>
      <ChatAnswerPicker
        label={t('settings.whatsapp.chats.answerWith')}
        value={answer}
        bots={bots}
        defaultBotName={defaultBotName}
        withNone={false}
        disabled={route.isPending}
        onChange={setAnswer}
      />
      <Button
        size="sm"
        variant="primary"
        pending={route.isPending && route.variables?.answer.kind !== 'none'}
        disabled={route.isPending}
        onClick={() => route.mutate({ accountId, chatIds, answer: answerOf(answer) })}
      >
        {t('settings.whatsapp.chats.apply')}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        pending={route.isPending && route.variables?.answer.kind === 'none'}
        disabled={route.isPending}
        onClick={() => route.mutate({ accountId, chatIds, answer: { kind: 'none' } })}
      >
        {t('settings.whatsapp.chats.stop')}
      </Button>
      <Button size="sm" variant="ghost" disabled={route.isPending} onClick={onDone}>
        {t('settings.whatsapp.chats.clear')}
      </Button>
      <ErrorAlert
        error={route.error}
        fallback={t('settings.whatsapp.chats.routeFailed')}
        onDismiss={route.reset}
      />
    </section>
  );
}
