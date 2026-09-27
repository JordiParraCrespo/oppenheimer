import { SessionItem } from '@oppenheimer/design-system-web';
import type { ProjectEntity, SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';
import { compactAge } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionRowMenu } from '../components/session-row-menu';

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

/** What a row can ask of the sidebar: the callbacks, per session. */
export interface SessionRowActions {
  menuFor: string | null;
  onMenuOpenChange: (session: SessionEntity, open: boolean) => void;
  renaming: { id: string; draft: string } | null;
  onRenameDraft: (session: SessionEntity, draft: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onRename: (session: SessionEntity) => void;
  onMove: (session: SessionEntity, projectId: string) => void;
  onDelete: (session: SessionEntity) => void;
  moveTargets: (session: SessionEntity) => ProjectEntity[];
}

/**
 * One row. The age is derived on render rather than held: `compactAge` returns
 * the unit and the count, and the words are ours to translate — `null` is
 * "less than a minute", which the artboard leaves blank rather than labelling.
 * The ellipsis is the row's `action`, shown on hover and while its menu is
 * open; the inline rename replaces the name and hides both.
 *
 * The row subscribes to whether it is the open session, not the route: the
 * router hands each row one boolean, so a navigation re-renders the two rows
 * whose highlight moved and not the sidebar above them. The session is the
 * list query's, kept by reference across a poll that did not change it, and
 * `now` is the sidebar's one minute clock.
 */
export function SessionRow({
  session,
  now,
  rows,
}: {
  session: SessionEntity;
  now: number;
  rows: SessionRowActions;
}) {
  const { t } = useTranslation();
  const active = useRouterState({
    select: (state) => state.location.pathname === `/sessions/${session.id}`,
  });
  const age = compactAge(session.createdAt, now);
  const menuOpen = rows.menuFor === session.id;
  const rename: ComponentProps<typeof SessionItem>['rename'] =
    rows.renaming?.id === session.id
      ? {
          value: rows.renaming.draft,
          onValueChange: (draft) => rows.onRenameDraft(session, draft),
          onCommit: rows.onRenameCommit,
          onCancel: rows.onRenameCancel,
          label: t('sessions.sidebar.renameLabel'),
        }
      : undefined;

  return (
    <SessionItem
      name={session.name}
      age={age ? t(`common.relative.${age.unit}`, { count: age.count }) : undefined}
      state={dotFor(session)}
      active={active}
      render={<Link to="/sessions/$sessionId" params={{ sessionId: session.id }} />}
      menuOpen={menuOpen}
      rename={rename}
      action={
        <SessionRowMenu
          open={menuOpen}
          onOpenChange={(open) => rows.onMenuOpenChange(session, open)}
          onRename={() => rows.onRename(session)}
          onMove={(projectId) => rows.onMove(session, projectId)}
          onDelete={() => rows.onDelete(session)}
          projects={rows.moveTargets(session).map((target) => ({
            id: target.id,
            name: target.name,
            isUnassigned: target.isUnassigned,
          }))}
        />
      }
    />
  );
}
