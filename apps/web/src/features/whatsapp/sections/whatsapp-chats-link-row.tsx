import { Button, SettingsListRow } from '@oppenheimer/design-system-web';
import type { WhatsappAccountEntity } from '@oppenheimer/frontend-consumer';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Where the groups and people of a number are answered: its chats page,
 * which lists every chat it has seen with who answers each. Drawn under a
 * number once its owner's own number is confirmed.
 */
export function WhatsappChatsLinkRow({ account }: { account: WhatsappAccountEntity }) {
  const { t } = useTranslation();
  return (
    <SettingsListRow
      align="center"
      data-testid="whatsapp-chats-link"
      meta={t('settings.whatsapp.chats.linkMeta')}
      actions={
        <Button
          size="sm"
          variant="secondary"
          aria-label={t('settings.whatsapp.chats.manageLabel', { label: account.label })}
          render={<Link to="/settings/whatsapp/$accountId" params={{ accountId: account.id }} />}
        >
          {t('settings.whatsapp.chats.manage')}
        </Button>
      }
    >
      {t('settings.whatsapp.chats.title')}
    </SettingsListRow>
  );
}
