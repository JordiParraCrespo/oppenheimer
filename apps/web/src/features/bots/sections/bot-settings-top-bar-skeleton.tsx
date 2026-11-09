import { Button, IconButton, SettingsTopBar, Skeleton } from '@oppenheimer/design-system-web';
import { ChevronLeft, Ellipsis } from '@oppenheimer/design-system-web/icons';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The bar over a bot's settings before the bot answers, as
 * `BotSettingsTopBar` draws it: back to the chat and Open chat are real,
 * since they need only the bot's id, the face and the name are bars, and the
 * ellipsis waits, so the name does not shift when the bot lands.
 */
export function BotSettingsTopBarSkeleton({ botId }: { botId: string }) {
  const { t } = useTranslation();
  const chat = <Link to="/bots/$botId" params={{ botId }} />;
  return (
    <>
      <LoadingStatus />
      <SettingsTopBar
        aria-busy
        back={
          <IconButton variant="quiet" size="sm" aria-label={t('bots.settings.back')} render={chat}>
            <ChevronLeft />
          </IconButton>
        }
        avatar={<Skeleton shape="pill" className="size-7.5" />}
        title={
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3.5 w-32" />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" render={chat}>
              {t('bots.settings.openChat')}
            </Button>
            <IconButton aria-label={t('bots.chat.actions')} size="sm" variant="quiet" disabled>
              <Ellipsis />
            </IconButton>
          </>
        }
      />
    </>
  );
}
