import {
  Button,
  ChipSelectEmpty,
  ChipSelectItem,
  ChipSelectPopup,
  ChipSelectSearch,
  dotVariants,
  Popover,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { Paperclip } from '@oppenheimer/design-system-web/icons';
import type { SessionEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import {
  useHosts,
  useLinkTaskSession,
  useProjects,
  useSessions,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SessionAge } from '../components/session-age';
import { SESSION_STATUS, sessionStateOf } from '../lib/session-state';

/**
 * Link existing (`18-plan-product.md` §4, `Tasks.dc.html`): a pane under the
 * button, not a dialog over the task's. It searches the workspace's sessions
 * this task is not on yet, the task's project's first under its name; Enter
 * links the first match. A session may be on several tasks. Linking moves a
 * task in Later or To do to In progress, unless it moved since the pane opened.
 */
export function LinkSessionPicker({ task }: { task: TaskEntity }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: projectName } = useProjects({
    select: (rows) => rows.find((row) => row.id === task.projectId)?.name,
  });
  const { data: free } = useSessions({
    select: (rows) =>
      rows.filter((row) => !task.sessions.some((link) => link.sessionId === row.id)),
  });
  const { data: online } = useHosts({
    select: (rows) => new Map(rows.map((row) => [row.id, row.online])),
  });
  const link = useLinkTaskSession({
    onSuccess: () => {
      setOpen(false);
      setQuery('');
    },
  });

  const term = query.trim().toLowerCase();
  const matching = (free ?? []).filter(
    (row) =>
      !term ||
      `${row.name} ${row.cwdCheckout?.repositoryName ?? ''} ${row.agent}`
        .toLowerCase()
        .includes(term),
  );
  const mine = matching.filter((row) => row.projectId === task.projectId);
  const others = matching.filter((row) => row.projectId !== task.projectId);
  const pick = (session: SessionEntity) =>
    link.mutate({ id: task.id, sessionId: session.id, seenStatus: task.status });

  const row = (session: SessionEntity) => (
    <ChipSelectItem
      key={session.id}
      disabled={link.isPending}
      leading={
        <span
          className={dotVariants({
            state: SESSION_STATUS[sessionStateOf(session, online?.get(session.hostId))],
          })}
        />
      }
      trailing={
        <>
          <span className="shrink-0 font-mono text-[11px] text-fg-subtle">
            {session.cwdCheckout?.repositoryName}
          </span>
          <span className="figures w-7 shrink-0 text-right font-mono text-[11px] text-fg-subtle">
            <SessionAge date={session.createdAt} />
          </span>
        </>
      }
      mono
      onClick={() => pick(session)}
    >
      {session.name}
    </ChipSelectItem>
  );
  const heading = (label: string) => (
    <span className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-[0.02em] text-fg-subtle uppercase">
      {label}
    </span>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger render={<Button type="button" variant="ghost" size="sm" />}>
        <Paperclip />
        {t('tasks.dialog.linkExisting')}
      </PopoverTrigger>
      <ChipSelectPopup width={380} maxHeight={260} side="bottom" align="start">
        <ChipSelectSearch
          value={query}
          placeholder={t('tasks.link.search')}
          aria-label={t('tasks.link.search')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            const first = mine[0] ?? others[0];
            if (event.key === 'Enter' && first && !link.isPending) {
              event.preventDefault();
              pick(first);
            }
          }}
        />
        <ErrorAlert
          error={link.error}
          fallback={t('tasks.link.failed')}
          onDismiss={link.reset}
          className="m-1"
        />
        <div role="listbox" aria-label={t('tasks.link.search')} className="flex flex-col">
          {mine.length ? heading(t('tasks.link.inProject', { name: projectName ?? '' })) : null}
          {mine.map(row)}
          {mine.length && others.length ? heading(t('tasks.link.others')) : null}
          {others.map(row)}
          {matching.length ? null : (
            <ChipSelectEmpty>
              {free?.length
                ? t('tasks.link.noMatch', { query: query.trim() })
                : t('tasks.link.empty')}
            </ChipSelectEmpty>
          )}
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}
