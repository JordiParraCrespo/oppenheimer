import { Checkbox, SettingsListRow } from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappChatRouteEntity } from '@oppenheimer/frontend-consumer';
import { useRouteWhatsappChats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ChatAnswerPicker } from '@/features/whatsapp/components/chat-answer-picker';
import { ChatLastSeen } from '@/features/whatsapp/components/chat-last-seen';
import { answerOf, answerValue } from '@/features/whatsapp/lib/chat-filter';

/**
 * One chat of a number: ticked for a change to many, its name, whether it is
 * a group, when it last wrote, and who answers it, saved as it is picked.
 * Picking a bot or the default allows the chat; "Not answered" stops it.
 */
export function WhatsappChatRow({
  chat,
  bots,
  defaultBotName,
  selected,
  onSelect,
}: {
  chat: WhatsappChatRouteEntity;
  bots: readonly BotEntity[];
  defaultBotName: string | null;
  selected: boolean;
  onSelect: (selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const route = useRouteWhatsappChats();
  const kind = t(chat.isGroup ? 'settings.whatsapp.chats.group' : 'settings.whatsapp.chats.person');

  return (
    <SettingsListRow
      align="center"
      data-testid="whatsapp-chat"
      data-selected={selected || undefined}
      className="data-selected:bg-hover-surface"
      meta={
        <>
          {[kind, chat.isGroup ? null : chat.phone].filter(Boolean).join(' · ')}
          {' · '}
          <ChatLastSeen at={chat.lastAt} />
        </>
      }
      actions={
        <ChatAnswerPicker
          label={t('settings.whatsapp.chats.answerLabel', { chat: chat.title })}
          value={answerValue(chat.answer)}
          bots={bots}
          defaultBotName={defaultBotName}
          disabled={route.isPending}
          onChange={(value) =>
            route.mutate({
              accountId: chat.accountId,
              chatIds: [chat.chatId],
              answer: answerOf(value),
            })
          }
        />
      }
    >
      <span className="flex items-center gap-3">
        <Checkbox
          aria-label={t('settings.whatsapp.chats.selectLabel', { chat: chat.title })}
          checked={selected}
          onCheckedChange={(checked) => onSelect(checked === true)}
        />
        {chat.title}
      </span>
      <ErrorAlert
        error={route.error}
        fallback={t('settings.whatsapp.chats.routeFailed')}
        onDismiss={route.reset}
      />
    </SettingsListRow>
  );
}
