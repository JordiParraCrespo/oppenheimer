import { BotAvatar, Button, IconButton, SettingsTopBar } from '@oppenheimer/design-system-web';
import { ChevronLeft } from '@oppenheimer/design-system-web/icons';
import { useSuspenseBot } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BotActionsMenu } from '@/features/bots/components/bot-actions-menu';
import { DeleteBotDialog } from '@/features/bots/dialogs/delete-bot';

/**
 * The bar over a bot's settings (`design/version1/BotSettings.dc.html`): back
 * to its chat, its face and name, Open chat, and the ellipsis with Delete bot.
 * It follows the bot, so a rename on Profile shows here as it saves.
 */
export function BotSettingsTopBar({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const { data: bot, error } = useSuspenseBot(botId);
  const [deleting, setDeleting] = useState(false);
  const chat = <Link to="/bots/$botId" params={{ botId: bot.id }} />;

  return (
    <>
      <SettingsTopBar
        back={
          <IconButton variant="quiet" size="sm" aria-label={t('bots.settings.back')} render={chat}>
            <ChevronLeft />
          </IconButton>
        }
        avatar={<BotAvatar option={{ initials: bot.initials }} size={30} color={bot.avatarColor} />}
        title={bot.name}
        actions={
          <>
            <Button variant="secondary" size="sm" render={chat}>
              {t('bots.settings.openChat')}
            </Button>
            <BotActionsMenu onDelete={() => setDeleting(true)} />
          </>
        }
      />
      <ErrorAlert error={error} fallback={t('bots.settings.loadFailed')} className="mx-4 mt-2" />
      {deleting ? <DeleteBotDialog bot={bot} onClose={() => setDeleting(false)} /> : null}
    </>
  );
}
