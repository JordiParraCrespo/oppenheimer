import { SettingsGroup, SettingsListRowSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** A gateway card before it answers: its heading row and two of its chats. */
export function BotGatewaysSkeleton() {
  return (
    <div aria-busy>
      <LoadingStatus />
      <SettingsGroup>
        <SettingsListRowSkeleton className="items-center" />
        <SettingsListRowSkeleton className="items-center" />
        <SettingsListRowSkeleton className="items-center" />
      </SettingsGroup>
    </div>
  );
}
