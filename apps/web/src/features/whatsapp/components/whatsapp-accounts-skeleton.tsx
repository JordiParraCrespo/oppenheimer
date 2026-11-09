import { Button, SettingsGroup, SettingsListRowSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The linked numbers before they answer: one row on `SettingsListRow`'s own
 * frame, the name over the state and the number on its host, with Unlink
 * written and disabled, and Link another under the card, disabled too.
 */
export function WhatsappAccountsSkeleton() {
  const { t } = useTranslation();
  return (
    <div aria-busy>
      <LoadingStatus />
      <SettingsGroup>
        <SettingsListRowSkeleton
          className="items-center"
          actions={
            <Button size="sm" variant="ghost" disabled>
              {t('settings.whatsapp.unlink')}
            </Button>
          }
        />
      </SettingsGroup>
      <div className="mt-4 flex justify-end">
        <Button variant="secondary" size="sm" disabled>
          {t('settings.whatsapp.linkAnother')}
        </Button>
      </div>
    </div>
  );
}
