import { Button, SettingsGroup, SettingsRow, Skeleton } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * Chat history before the chat answers: its card and row, the count and the
 * newest message's date a bar at the label's line, Export and Clear history
 * written as they read with nothing to act on.
 */
export function BotChatHistorySkeleton() {
  const { t } = useTranslation();
  return (
    <SettingsGroup aria-busy>
      <SettingsRow
        aria-hidden
        label={
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className="h-3 w-48" />
          </span>
        }
      >
        <Button variant="secondary" size="sm" disabled tabIndex={-1}>
          {t('bots.settings.profile.export')}
        </Button>
        <Button variant="secondary" size="sm" disabled tabIndex={-1}>
          {t('bots.settings.profile.clear')}
        </Button>
      </SettingsRow>
      <span role="status" className="sr-only">
        {t('common.loading')}
      </span>
    </SettingsGroup>
  );
}
