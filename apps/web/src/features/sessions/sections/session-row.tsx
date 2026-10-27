import { AgentMark, SortableSessionItem } from '@oppenheimer/design-system-web';
import { Folder, SquareTerminal } from '@oppenheimer/design-system-web/icons';
import { cloudProviderLabel, type SessionEntity } from '@oppenheimer/frontend-consumer';
import {
  useMoveSession,
  useProjectsSnapshot,
  useRenameSession,
} from '@oppenheimer/frontend-consumer/react';
import { compactAge, notifySuccess } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { type ComponentProps, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionRowMenu } from '../components/session-row-menu';
import { useSessionPin } from '../hooks/use-session-pins';
import { useSessionSelected } from '../hooks/use-session-selection';
import { sessionGlyph } from '../lib/session-glyph';
import { projectsForMove } from '../lib/session-groups';
import { dotFor } from '../lib/session-run-state';
import { clickPick } from '../lib/session-selection';

/**
 * The age is derived on render: `compactAge` returns unit and count, the words
 * are ours to translate, and `null` ("less than a minute") stays blank as in
 * the artboard.
 *
 * The row owns what only it reads (its menu, the half-typed rename, the rename
 * and move writes), so one row's keystroke redraws no other row. What it cannot
 * own goes up as one call each: the delete and share dialogs, which must outlive the row,
 * and a failed write, which the sidebar shows because a menu closes on its pick
 * and the row has no room. Its pin is the sidebar's (`SessionPinsContext`),
 * which draws a pinned row under Pinned. It subscribes to one boolean for being
 * the open session, not the route, so a navigation re-renders only the two rows
 * whose highlight moved; `now` is its group's one-minute clock. The row drags, up
 * or down its project or into another; the sidebar keeps where it lands.
 *
 * A cloud session's row leads with its vendor's mark and opens the vendor's
 * page for its agent in a tab of its own (`SessionsConsole.dc.html`), where it
 * is followed up and stopped; there is no terminal of ours to open or share.
 *
 * Its pick is the sidebar's selection (`SessionSelectionContext`): a click with
 * ⌘, Ctrl or Shift picks the row instead of opening it, and so does any click
 * while something is picked. While the list is selecting, the row draws its
 * box, does not drag and hides its menu, since what it acts on is the bar's.
 */
export function SessionRow({
  session,
  now,
  onShare,
  dragDisabled,
  onDelete,
  onWrite,
}: {
  session: SessionEntity;
  now: number;
  onShare: (session: SessionEntity) => void;
  /** Whether the row stays put: while a filter or the search hides some of its neighbours. */
  dragDisabled: boolean;
  onDelete: (session: SessionEntity) => void;
  /** A write this row made settled: its error, or null when it landed. */
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const active = useRouterState({
    select: (state) => state.location.pathname === `/sessions/${session.id}`,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const pin = useSessionPin(session.id);
  const selection = useSessionSelected(session.id);
  const [draft, setDraft] = useState<string | null>(null);
  // The projects are read, not subscribed to: the move pane is the one thing
  // that needs them, it is drawn only while the menu is up (and opening it
  // renders the row), and a closed row then pays nothing when a project
  // changes. The sidebar's own subscription keeps the list in the cache.
  const projectsSnapshot = useProjectsSnapshot();
  const moveTargets = () => projectsForMove(projectsSnapshot() ?? [], session);
  // The toasts are the hooks' own, not `mutate`'s: a moved row lands in
  // another group, and the row that asked unmounts before the write settles.
  // A renamed or moved row can land anywhere in a long, grouped list, so both
  // say where it went.
  const rename = useRenameSession({
    onSuccess: (renamed) => {
      onWrite(null);
      notifySuccess('sessionRenamed', { name: renamed.name });
    },
    onError: onWrite,
  });
  const move = useMoveSession({
    onSuccess: (moved, { projectId }) => {
      onWrite(null);
      const target = projectsSnapshot()?.find((project) => project.id === projectId);
      const project = target?.isUnassigned ? t('projects.unassigned') : (target?.name ?? '');
      notifySuccess('sessionMoved', { name: moved.name, project });
    },
    onError: onWrite,
  });
  const age = compactAge(session.createdAt, now);
  const glyph = sessionGlyph(session);
  // A deleted row back in the list is never back as it was (`useCloseSession`).
  const status = session.closeRefusal
    ? t('sessions.sidebar.notDeleted')
    : session.isClosing
      ? t('sessions.sidebar.deleting')
      : undefined;
  const cloudUrl = session.cloud?.url ?? null;
  const statusHint = session.closeRefusal
    ? t('sessions.sidebar.notDeletedHint')
    : session.isClosing
      ? t('sessions.sidebar.deletingHint')
      : session.cloud
        ? t('sessions.sidebar.openAtVendor', { vendor: cloudProviderLabel(session.cloud.provider) })
        : undefined;

  function commitRename() {
    const name = draft?.trim();
    if (name && name !== session.name) rename.mutate({ id: session.id, name });
    setDraft(null);
  }

  const renameField: ComponentProps<typeof SortableSessionItem>['rename'] =
    draft === null
      ? undefined
      : {
          value: draft,
          onValueChange: setDraft,
          onCommit: commitRename,
          onCancel: () => setDraft(null),
          label: t('sessions.sidebar.renameLabel'),
        };

  return (
    <SortableSessionItem
      id={session.id}
      disabled={dragDisabled || selection.selecting}
      name={session.name}
      age={age ? t(`common.relative.${age.unit}`, { count: age.count }) : undefined}
      status={status}
      title={statusHint}
      state={dotFor(session)}
      // The branch is the row's own default glyph.
      icon={
        glyph === 'vendor' ? (
          <AgentMark agent={session.agent} />
        ) : glyph === 'terminal' ? (
          <SquareTerminal />
        ) : glyph === 'folder' ? (
          <Folder />
        ) : undefined
      }
      active={active}
      // What the row is a link to: the session's page, or a cloud session's
      // agent at its vendor. The row's props carry what is drawn inside it.
      render={
        cloudUrl ? (
          (props) => <a {...props} href={cloudUrl} target="_blank" rel="noreferrer" />
        ) : (
          <Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />
        )
      }
      // Runs before the link's own click, which stands down on a prevented one.
      onClick={(event) => {
        const how = clickPick(event, selection.selecting);
        if (!how) return;
        event.preventDefault();
        selection.pick(how);
      }}
      selected={selection.selecting ? selection.selected : undefined}
      selectedLabel={t('sessions.sidebar.selected')}
      menuOpen={menuOpen}
      rename={renameField}
      action={
        selection.selecting ? undefined : (
          <SessionRowMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            pinned={pin.pinned}
            onPinChange={pin.setPinned}
            onSelect={() => selection.pick('toggle')}
            onRename={() => setDraft(session.name)}
            onMove={(projectId) => move.mutate({ id: session.id, projectId })}
            onShare={session.isCloud ? undefined : () => onShare(session)}
            onDelete={() => onDelete(session)}
            projects={(menuOpen ? moveTargets() : []).map((target) => ({
              id: target.id,
              name: target.name,
              isUnassigned: target.isUnassigned,
            }))}
          />
        )
      }
    />
  );
}
