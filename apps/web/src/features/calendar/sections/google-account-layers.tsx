import { CalendarLayerItem } from '@oppenheimer/design-system-web';
import { useGoogleCalendarConnections } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { GoogleAccountSwatch } from '../components/google-account-swatch';
import { useHiddenAccounts } from '../hooks/use-hidden-accounts';
import { accentOf } from '../lib/google-accounts';

/**
 * The Google layer's accounts, one toggle each, under the layer's own
 * (`23-plan-milestones-stats-accounts.md` §5). Which ones are off is this
 * viewer's, kept on this device, not on the server; nothing with fewer than
 * two accounts, where the layer's toggle already says it all.
 */
export function GoogleAccountLayers() {
  const { t } = useTranslation();
  const { data: connections = [] } = useGoogleCalendarConnections();
  const { hidden, toggle } = useHiddenAccounts();
  if (connections.length < 2) return null;

  return (
    <fieldset aria-label={t('calendar.layers.google')} className="flex flex-col gap-0.5 pl-5">
      {connections.map((connection) => (
        <CalendarLayerItem
          key={connection.id}
          icon={<GoogleAccountSwatch accent={accentOf(connection.colorIndex)} />}
          checked={!hidden.includes(connection.id)}
          onCheckedChange={() => toggle(connection.id)}
        >
          {connection.accountEmail}
        </CalendarLayerItem>
      ))}
    </fieldset>
  );
}
