import { SettingsGroup, SettingsListRow, Skeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/**
 * The watched repositories before they answer: the settings card with two of
 * its rows, a name and the × to stop watching, at the rows' height.
 */
export function WatchedRepositoriesSkeleton() {
  return (
    <SettingsGroup aria-busy>
      <LoadingStatus />
      {['w-44', 'w-36'].map((width) => (
        <SettingsListRow
          key={width}
          align="center"
          aria-hidden
          actions={<Skeleton shape="sm" className="mx-2 size-3.5" />}
        >
          <span className="flex h-5 items-center">
            <Skeleton shape="sm" className={`h-3 ${width}`} />
          </span>
        </SettingsListRow>
      ))}
    </SettingsGroup>
  );
}
