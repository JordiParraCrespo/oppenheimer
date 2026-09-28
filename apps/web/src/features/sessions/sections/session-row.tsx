import { SessionItem } from '@oppenheimer/design-system-web';
import type { SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';
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
import { projectsForMove } from '../lib/session-groups';

/**
 * How a session's **group** reads as a dot.
 *
 * The group is what the sidebar shows because it is organised by what needs
 * you rather than by what a process is doing
 * (`product/versions/mvp/05-screens.md`): a session that failed, one whose
 * agent has been blocked for thirty seconds and one whose launch has sat
 * unready for a minute all want the same glance. `working` is the pulsing dot
 * of a session with something happening on a machine elsewhere.
 *
 * One dot is not the group's to give: a session the host has not built yet
 * reads as `idle`, because nothing needs you about it — but the artboard draws
 * it joining the list at once with a pulsing grey glyph, and that is the
 * **lifecycle** speaking, not the group. {@link dotFor} puts the two together.
 */
const DOT: Record<SessionGroup, 'running' | 'idle' | 'failed' | 'pending' | 'completed'> = {
  working: 'running',
  'waiting-on-you': 'failed',
  'ready-for-review': 'running',
  landing: 'pending',
  idle: 'idle',
  resolved: 'completed',
};

/** The dot a row shows: provisioning first, then what needs you. */
function dotFor(session: SessionEntity) {
  return session.isProvisioning ? 'pending' : DOT[session.state];
}

/**
 * One row. The age is derived on render rather than held: `compactAge` returns
 * the unit and the count, and the words are ours to translate — `null` is
 * "less than a minute", which the artboard leaves blank rather than labelling.
 * The ellipsis is the row's `action`, shown on hover and while its menu is
 * open; the inline rename replaces the name and hides both.
 *
 * The row owns what only it reads: whether its menu is open, the half-typed
 * rename, and the two writes its menu makes — a rename commits from the inline
 * input, a move from the menu's pane. They lived in the sidebar once, behind
 * an object of callbacks rebuilt on every sidebar render and handed to every
 * row, so one row's rename keystroke redrew them all. What a row cannot own
 * goes up as one call each: the delete dialog (the sidebar mounts it, so it
 * outlives the row it deletes) and a failed write (the sidebar shows it above
 * the list, because a menu closes on its pick and the row has no room).
 *
 * The row subscribes to whether it is the open session, not the route: the
 * router hands each row one boolean, so a navigation re-renders the two rows
 * whose highlight moved and not the sidebar above them. The session is the
 * list query's, kept by reference across a poll that did not change it, and
 * `now` is its group's one minute clock.
 */
export function SessionRow({
  session,
  now,
  onDelete,
  onWrite,
}: {
  session: SessionEntity;
  now: number;
  onDelete: (session: SessionEntity) => void;
  /** A write this row made settled: its error, or null when it landed. */
  onWrite: (error: Error | null) => void;
}) {
  const { t } = useTranslation();
  const active = useRouterState({
    select: (state) => state.location.pathname === `/sessions/${session.id}`,
  });
  const [menuOpen, setMenuOpen] = useState(false);
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

  function commitRename() {
    const name = draft?.trim();
    if (name && name !== session.name) rename.mutate({ id: session.id, name });
    setDraft(null);
  }

  const renameField: ComponentProps<typeof SessionItem>['rename'] =
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
    <SessionItem
      name={session.name}
      age={age ? t(`common.relative.${age.unit}`, { count: age.count }) : undefined}
      state={dotFor(session)}
      active={active}
      render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
      menuOpen={menuOpen}
      rename={renameField}
      action={
        <SessionRowMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          onRename={() => setDraft(session.name)}
          onMove={(projectId) => move.mutate({ id: session.id, projectId })}
          onDelete={() => onDelete(session)}
          projects={(menuOpen ? moveTargets() : []).map((target) => ({
            id: target.id,
            name: target.name,
            isUnassigned: target.isUnassigned,
          }))}
        />
      }
    />
  );
}
