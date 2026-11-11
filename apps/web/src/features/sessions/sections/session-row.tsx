import { AgentMark, SortableSessionItem } from '@oppenheimer/design-system-web';
import { Cloud, EyeOff, Folder, SquareTerminal } from '@oppenheimer/design-system-web/icons';
import { cloudProviderLabel, type SessionEntity } from '@oppenheimer/frontend-consumer';
import {
  useMoveSession,
  useProjectsSnapshot,
  useRenameSession,
  useSetSessionHidden,
} from '@oppenheimer/frontend-consumer/react';
import { compactAge, notifySuccess } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import type { TFunction } from 'i18next';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionRowMenu } from '../components/session-row-menu';
import { useSessionPin } from '../hooks/use-session-pins';
import { useSessionSelected } from '../hooks/use-session-selection';
import { type SessionGlyph, sessionGlyph } from '../lib/session-glyph';
import { dotFor, isWorking } from '../lib/session-run-state';
import { clickPick } from '../lib/session-selection';

/** The row's lead glyph; the branch is the row's own default, a vendor's mark the session's own. */
const GLYPHS: Record<Exclude<SessionGlyph, 'vendor'>, ReactNode> = {
  terminal: <SquareTerminal />,
  folder: <Folder />,
  cloud: <Cloud />,
  branch: undefined,
};

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
 * Otherwise a right-click opens the row's menu at its ellipsis.
 */
/**
 * What the row says in its age's place, first match wins: a delete the host
 * refused, a delete under way, then the eye of a hidden session. A deleted
 * row back in the list is never back as it was (`useCloseSession`).
 */
function rowStatus(session: SessionEntity, t: TFunction): ReactNode {
  if (session.closeRefusal) return t('sessions.sidebar.notDeleted');
  if (session.isClosing) return t('sessions.sidebar.deleting');
  if (session.hidden) {
    return <EyeOff role="img" aria-label={t('sessions.sidebar.hidden')} className="size-3.5" />;
  }
  return undefined;
}

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
  const visibility = useSetSessionHidden({
    onSuccess: (changed, { hidden }) => {
      onWrite(null);
      notifySuccess(hidden ? 'sessionHidden' : 'sessionShown', { name: changed.name });
    },
    onError: onWrite,
  });
  const age = compactAge(session.createdAt, now);
  const glyph = sessionGlyph(session);
  const status = rowStatus(session, t);
  const cloudUrl = session.cloud?.url ?? null;
  // The row has a menu unless the list is selecting (the bar acts) or its name
  // is being typed; every way of opening the menu reads this.
  const hasMenu = !selection.selecting && draft === null;
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
      working={isWorking(session)}
      // The branch is the row's own default glyph.
      icon={glyph === 'vendor' ? <AgentMark agent={session.agent} /> : GLYPHS[glyph]}
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
      // A right-click opens the row's own menu, not the browser's.
      onContextMenu={
        hasMenu
          ? (event) => {
              event.preventDefault();
              setMenuOpen(true);
            }
          : undefined
      }
      selected={selection.selecting ? selection.selected : undefined}
      selectedLabel={t('sessions.sidebar.selected')}
      menuOpen={menuOpen}
      rename={renameField}
      action={
        hasMenu ? (
          <SessionRowMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            pinned={pin.pinned}
            onPinChange={pin.setPinned}
            hidden={session.hidden}
            onHiddenChange={(hidden) => visibility.mutate({ id: session.id, hidden })}
            onSelect={() => selection.pick('toggle')}
            onRename={() => setDraft(session.name)}
            onMove={(projectId) => move.mutate({ id: session.id, projectId })}
            onShare={session.isCloud ? undefined : () => onShare(session)}
            onDelete={() => onDelete(session)}
            projects={(menuOpen ? (projectsSnapshot() ?? []) : []).map((target) => ({
              id: target.id,
              name: target.name,
              isUnassigned: target.isUnassigned,
            }))}
            currentProjectId={session.projectId}
          />
        ) : undefined
      }
    />
  );
}
