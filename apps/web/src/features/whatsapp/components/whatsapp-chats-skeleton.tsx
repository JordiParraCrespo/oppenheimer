import { SettingsGroup, SettingsListRowSkeleton } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';

/** A number's chats before they answer: a page's worth of rows on the rows' own frame. */
export function WhatsappChatsSkeleton() {
  return (
    <div aria-busy>
      <LoadingStatus />
      <SettingsGroup>
        {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
          <SettingsListRowSkeleton key={key} className="items-center" />
        ))}
      </SettingsGroup>
    </div>
  );
}
