import { Button, SettingsGroup, SettingsListRowSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The Gmail accounts before they answer: one row on `SettingsListRow`'s own
 * frame, the name over the state and the address, with Rename and Disconnect
 * written and disabled, and Connect another under the card, disabled too.
 */
export function GmailAccountsSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy>
      <LoadingStatus />
      <SettingsGroup>
        <SettingsListRowSkeleton
          className="items-center"
          actions={
            <>
              <Button size="sm" variant="ghost" disabled>
                {t('settings.mail.rename')}
              </Button>
              <Button size="sm" variant="ghost" disabled>
                {t('settings.mail.disconnect')}
              </Button>
            </>
          }
        />
      </SettingsGroup>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" size="sm" disabled>
          {t('settings.mail.connectAnother')}
        </Button>
      </div>
    </div>
  );
}
