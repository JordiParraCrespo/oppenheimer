import { Button, SettingsGroup, SettingsListRow } from '@oppenheimer/design-system-web';
import type { BotEntity, WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { useSuspenseWhatsappChats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AddBotWhatsappChatsDialog } from '@/features/bots/dialogs/add-bot-whatsapp-chats';
import { BotWhatsappChatRow } from '@/features/bots/sections/bot-whatsapp-chat-row';

/**
 * One WhatsApp number from this bot's side: whether the bot is its default,
 * how many groups and people it answers there, Add chats (which owns its own
 * dialog and write) and the way to the number's page, then one row per chat
 * the bot answers by name.
 */
export function BotWhatsappNumber({
  botId,
  account,
  bots,
}: {
  botId: string;
  account: WhatsappAccountEntity;
  bots: readonly BotEntity[];
}) {
  const { t } = useTranslation();
  const { data: chats, error } = useSuspenseWhatsappChats(account.id);
  const [adding, setAdding] = useState(false);
  const mine = chats.filter((chat) => chat.answer.kind === 'bot' && chat.answer.botId === botId);
  const groups = mine.filter((chat) => chat.isGroup).length;
  const isDefault = account.answeringBotId === botId;
  const defaultName = bots.find((bot) => bot.id === account.answeringBotId)?.name ?? null;

  return (
    <SettingsGroup data-testid="bot-whatsapp-gateway">
      <SettingsListRow
        align="center"
        meta={[
          t('bots.settings.gateways.answers', { groups, people: mine.length - groups }),
          isDefault
            ? t('bots.settings.gateways.isDefault')
            : defaultName
              ? t('bots.settings.gateways.defaultIs', { bot: defaultName })
              : t('bots.settings.gateways.noDefault'),
        ].join(' · ')}
        actions={
          <>
            <Button
              size="sm"
              variant="ghost"
              render={
                <Link to="/settings/whatsapp/$accountId" params={{ accountId: account.id }} />
              }
            >
              {t('bots.settings.gateways.numberSettings')}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              {t('bots.settings.gateways.add')}
            </Button>
          </>
        }
      >
        {t('bots.settings.gateways.whatsappTitle', { label: account.label })}
        <ErrorAlert error={error} fallback={t('bots.settings.gateways.chatsFailed')} />
      </SettingsListRow>
      {mine.map((chat) => (
        <BotWhatsappChatRow key={chat.chatId} chat={chat} />
      ))}
      {mine.length === 0 ? (
        <SettingsListRow muted>{t('bots.settings.gateways.noneHere')}</SettingsListRow>
      ) : null}
      {adding ? (
        <AddBotWhatsappChatsDialog
          botId={botId}
          accountId={account.id}
          chats={chats}
          bots={bots}
          defaultBotId={account.answeringBotId}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </SettingsGroup>
  );
}
