import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { SessionEntity, TaskEntity } from '@oppenheimer/frontend-consumer';
import { useLinkTaskSession, useProjects, useSessions } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * Link existing (`18-plan-product.md` §4): a searchable list of the
 * workspace's sessions this task is not on yet, the task's project's first.
 * A session may be on several tasks. Linking moves a task in Later or To do
 * to In progress, unless it moved since the dialog opened.
 */
export function LinkSessionPicker({ task, onClose }: { task: TaskEntity; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: projectName } = useProjects({
    select: (rows) => rows.find((row) => row.id === task.projectId)?.name,
  });
  const { data: sessions } = useSessions({
    select: (rows) =>
      rows.filter((row) => !task.sessions.some((link) => link.sessionId === row.id)),
  });
  const link = useLinkTaskSession({ onSuccess: onClose });
  const inProject = (sessions ?? []).filter((row) => row.projectId === task.projectId);
  const others = (sessions ?? []).filter((row) => row.projectId !== task.projectId);

  const item = (session: SessionEntity) => (
    <CommandItem
      key={session.id}
      value={`${session.name} ${session.id}`}
      disabled={link.isPending}
      onSelect={() => link.mutate({ id: task.id, sessionId: session.id, seenStatus: task.status })}
    >
      <span className="min-w-0 flex-1 truncate font-mono">{session.name}</span>
      <span className="shrink-0 text-xs text-fg-subtle">{session.scopeLabel}</span>
    </CommandItem>
  );

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('tasks.link.title')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-6 pb-6">
          <ErrorAlert error={link.error} fallback={t('tasks.link.failed')} onDismiss={link.reset} />
          <Command className="rounded-md border border-border-subtle">
            <CommandInput
              placeholder={t('tasks.link.search')}
              aria-label={t('tasks.link.search')}
            />
            <CommandList>
              <CommandEmpty>{t('tasks.link.empty')}</CommandEmpty>
              {inProject.length ? (
                <CommandGroup heading={t('tasks.link.inProject', { name: projectName ?? '' })}>
                  {inProject.map(item)}
                </CommandGroup>
              ) : null}
              {others.length ? (
                <CommandGroup heading={t('tasks.link.others')}>{others.map(item)}</CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </div>
      </DialogContent>
    </Dialog>
  );
}
