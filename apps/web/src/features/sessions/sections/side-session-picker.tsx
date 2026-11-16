import { SearchList } from '@oppenheimer/design-system-web';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';

/**
 * The launcher's Session pane: every other session in the workspace, on any
 * host, searchable. The list is the sidebar's read, so it is usually cached;
 * a failed read leaves it empty, which the pane says.
 */
export function SideSessionPicker({
  currentSessionId,
  onPick,
}: {
  currentSessionId: string;
  onPick: (sessionId: string) => void;
}) {
  const { t } = useTranslation();
  const { data: options = [] } = useSessions({
    select: (sessions) =>
      sessions
        .filter((session) => session.id !== currentSessionId && !session.isResolved)
        .map((session) => ({
          value: session.id,
          label: session.name,
          description: session.cwdCheckout?.branch ?? undefined,
        })),
  });

  return (
    <SearchList
      aria-label={t('sessions.side.launcher.sessions')}
      options={options}
      value={null}
      onPick={(option) => onPick(option.value)}
      searchPlaceholder={t('sessions.side.launcher.searchSessions')}
      emptyText={(query) =>
        query
          ? t('sessions.side.launcher.noMatch', { query })
          : t('sessions.side.launcher.noSessions')
      }
      rows={10}
    />
  );
}
