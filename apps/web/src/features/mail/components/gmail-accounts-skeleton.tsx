import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * The Gmail accounts before they answer: one row on `SettingsListRow`'s own
 * frame, the name over the address, the state, and the row's buttons.
 */
export function GmailAccountsSkeleton() {
  return (
    <SettingsGroup aria-busy>
      <SettingsListRow
        align="center"
        aria-hidden
        meta={<Skeleton shape="sm" className="h-2.5 w-40" />}
        kind={<Skeleton shape="sm" className="h-2 w-20" />}
        actions={<Skeleton shape="pill" className="h-7 w-32" />}
      >
        <Skeleton shape="sm" className="h-3 w-24" />
      </SettingsListRow>
      <LoadingStatus />
    </SettingsGroup>
  );
}
