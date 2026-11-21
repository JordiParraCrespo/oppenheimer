import { SettingsGroup, SettingsListRowSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** A number's page before it answers: its row, its default bot and the reader's own number. */
export function WhatsappNumberSkeleton() {
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
