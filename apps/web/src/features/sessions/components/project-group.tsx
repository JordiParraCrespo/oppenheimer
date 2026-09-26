import {
  IconButton,
  SessionItem,
  SessionList,
  SidebarEmptyRow,
  SidebarProjectHeader,
} from '@oppenheimer/design-system-web';
import { Plus, Settings } from '@oppenheimer/design-system-web/icons';
import type { ProjectEntity, SessionEntity, SessionGroup } from '@oppenheimer/frontend-consumer';
import { compactAge } from '@oppenheimer/frontend-web';
import type { ComponentProps, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionRowMenu } from './session-row-menu';

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

/** What a row can ask of the section: the callbacks, per session. */
export interface SessionRowActions {
  /** The router's link to a session's pane, made by the section: a component draws no route of its own. */
  link: (session: SessionEntity) => ReactElement;
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
 * One project's group in the sidebar: the folding header with its count and
 * hover actions, then its rows or the empty row. `project` is null for the
 * sessions whose project the list does not hold, which get a header with no
 * actions.
 *
 * Props in, choice out. The section owns the open set, the menu and rename
 * state and every mutation; this draws one group and reports what was
 * clicked.
 */
export function ProjectGroup({
  project,
  sessions,
  open,
  onOpenChange,
  pathname,
  narrowed,
  query,
  onNewSessionHere,
  onSettings,
  rows,
}: {
  project: ProjectEntity | null;
  sessions: SessionEntity[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  /** Whether a filter or the search is narrowing the list, which changes what an empty group says. */
  narrowed: boolean;
  query: string;
  onNewSessionHere: (project: ProjectEntity) => void;
  onSettings: (project: ProjectEntity) => void;
  rows: SessionRowActions;
}) {
  const { t } = useTranslation();

  return (
    <div className="mt-1.5 flex flex-col">
      <SidebarProjectHeader
        name={project?.name ?? t('sessions.sidebar.unfiled')}
        count={sessions.length}
        open={open}
        onOpenChange={onOpenChange}
        current={sessions.some((session) => pathname === `/sessions/${session.id}`)}
        actions={
          project ? (
            <>
              <IconButton
                size="xs"
                variant="quiet"
                aria-label={t('sessions.sidebar.newSessionHere', { name: project.name })}
                onClick={() => onNewSessionHere(project)}
              >
                <Plus />
              </IconButton>
              <IconButton
                size="xs"
                variant="quiet"
                aria-label={t('sessions.sidebar.projectSettings', { name: project.name })}
                onClick={() => onSettings(project)}
              >
                <Settings />
              </IconButton>
            </>
          ) : undefined
        }
      />
      {!open ? null : sessions.length === 0 ? (
        <SidebarEmptyRow>
          {narrowed
            ? t('sessions.sidebar.noMatches', { query })
            : t('sessions.sidebar.emptyProject')}{' '}
          {project && !narrowed ? (
            <button type="button" onClick={() => onNewSessionHere(project)}>
              {t('sessions.sidebar.startOne')}
            </button>
          ) : null}
        </SidebarEmptyRow>
      ) : (
        <SessionList className="px-3">
          {sessions.map((session) => (
            <SessionRow key={session.id} session={session} pathname={pathname} rows={rows} />
          ))}
        </SessionList>
      )}
    </div>
  );
}

/**
 * One row. The age is derived on render rather than held: `compactAge` returns
 * the unit and the count, and the words are ours to translate — `null` is
 * "less than a minute", which the artboard leaves blank rather than labelling.
 * The ellipsis is the row's `action`, shown on hover and while its menu is
 * open; the inline rename replaces the name and hides both.
 */
function SessionRow({
  session,
  pathname,
  rows,
}: {
  session: SessionEntity;
  pathname: string;
  rows: SessionRowActions;
}) {
  const { t } = useTranslation();
  const age = compactAge(session.createdAt);
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
      active={pathname === `/sessions/${session.id}`}
      render={rows.link(session)}
      menuOpen={menuOpen}
      rename={rename}
      action={
        <SessionRowMenu
          open={menuOpen}
          onOpenChange={(open) => rows.onMenuOpenChange(session, open)}
          onRename={() => rows.onRename(session)}
          onMove={(projectId) => rows.onMove(session, projectId)}
          onDelete={() => rows.onDelete(session)}
          projects={rows
            .moveTargets(session)
            .map((target) => ({ id: target.id, name: target.name }))}
        />
      }
    />
  );
}
