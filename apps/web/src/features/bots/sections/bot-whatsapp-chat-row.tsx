import { Button, SettingsListRow } from '@oppenheimer/design-system-web';
import type { WhatsappChatRouteEntity } from '@oppenheimer/frontend-consumer';
import { useRouteWhatsappChats } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * A chat this bot answers on a number: its name, whether it is a group, and
 * Remove, which stops answering it there (no bot answers it after; another
 * can be given it from the number's page).
 */
export function BotWhatsappChatRow({ chat }: { chat: WhatsappChatRouteEntity }) {
  const { t } = useTranslation();
  const route = useRouteWhatsappChats();

  return (
    <SettingsListRow
      align="center"
      data-testid="bot-whatsapp-chat"
      kind={t(chat.isGroup ? 'bots.settings.gateways.group' : 'bots.settings.gateways.person')}
      meta={chat.isGroup ? null : chat.phone}
      actions={
        <Button
          size="sm"
          variant="ghost"
          pending={route.isPending}
          aria-label={t('bots.settings.gateways.removeLabel', { chat: chat.title })}
          onClick={() =>
            route.mutate({
              accountId: chat.accountId,
              chatIds: [chat.chatId],
              answer: { kind: 'none' },
            })
          }
        >
          {t('bots.settings.gateways.remove')}
        </Button>
      }
    >
      {chat.title}
      <ErrorAlert
        error={route.error}
        fallback={t('bots.settings.gateways.routeFailed')}
        onDismiss={route.reset}
      />
    </SettingsListRow>
  );
}
