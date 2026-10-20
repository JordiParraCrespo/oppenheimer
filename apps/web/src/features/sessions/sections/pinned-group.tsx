import {
  SessionList,
  SidebarProjectGroup,
  SidebarProjectHeader,
  SortableGroup,
  useNow,
} from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { CORE_CONFIG } from '@oppenheimer/frontend-core/config';
import { useTranslation } from 'react-i18next';
import { SessionRow } from './session-row';

/** The `SortableGroup` the pinned rows sit in: it takes no drop, and its rows do not drag. */
const PINNED_GROUP = 'pinned';

/**
 * The sessions the reader pinned, above the projects, under an eyebrow head
 * like Employees' groups: a pin is the reader's shortcut, not a project. A
 * pinned row is drawn here instead of in its project, in the order it was
 * pinned, and keeps the menu it has there, Unpin included. It owns its ages'
 * clock, like a project's group.
 */
export function PinnedGroup({
  sessions,
  open,
  onOpenChange,
  onPinChange,
  onShare,
  onDelete,
  onWrite,
}: {
  sessions: SessionEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPinChange: (session: SessionEntity, pinned: boolean) => void;
  onShare: (session: SessionEntity) => void;
  onDelete: (session: SessionEntity) => void;
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const now = useNow(CORE_CONFIG.clock.everyMinuteMs);

  return (
    <SidebarProjectGroup>
      <SortableGroup
        id={PINNED_GROUP}
        items={open ? sessions.map((session) => session.id) : []}
        accepts={[]}
        className="flex flex-col"
      >
        <SidebarProjectHeader
          tone="eyebrow"
          name={t('sessions.sidebar.pinned')}
          count={sessions.length}
          open={open}
          onOpenChange={onOpenChange}
        />
        {open ? (
          <SessionList>
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                now={now}
                pinned
                onPinChange={onPinChange}
                onShare={onShare}
                dragDisabled
                onDelete={onDelete}
                onWrite={onWrite}
              />
            ))}
          </SessionList>
        ) : null}
      </SortableGroup>
    </SidebarProjectGroup>
  );
}
