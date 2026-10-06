import {
  Callout,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FieldDescription,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { shortName } from '@oppenheimer/frontend-consumer';
import {
  useHostPresence,
  useProjects,
  useStartTaskSession,
  useTasks,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess, RelativeTime } from '@oppenheimer/frontend-web';
import { getRouteApi } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StartSessionForm } from '../forms/start-session-form';
import { startDefaults, toStartSession } from '../lib/start-session';

const board = getRouteApi('/_authenticated/plan/');

/**
 * Start session for a task (`18-plan-product.md` §4), open while the address
 * says `?start=<task>`. The session is New session's, filed under the task's
 * project and linked to it; the task moves to In progress unless it moved
 * since the click. The idempotency key is the dialog's, so a retried submit
 * does not start two sessions.
 */
export function StartSessionDialog() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { start } = board.useSearch();
  const navigate = board.useNavigate();
  const close = () => navigate({ search: (previous) => ({ ...previous, start: undefined }) });
  const { data: task } = useTasks({ select: (rows) => rows.find((row) => row.id === start) });
  const { data: project } = useProjects({
    select: (rows) => rows.find((row) => row.id === task?.projectId),
  });
  const hosts = useHostPresence();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const launch = useStartTaskSession({
    onSuccess: (started) => {
      notifySuccess(
        started.hints.includes('host_offline') ? 'taskSessionQueued' : 'taskSessionStarted',
      );
      close();
    },
  });
  if (!start) return null;

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('tasks.start.title')}</DialogTitle>
          {task ? (
            <DialogDescription>{t('tasks.start.for', { title: task.title })}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogBody>
          <div className="pb-6">
            {!task || !project || hosts.isPending ? (
              task === undefined ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <FieldDescription>{t('tasks.dialog.gone')}</FieldDescription>
              )
            ) : (
              <StartSessionForm
                values={startDefaults(task, project, hosts.data ?? [])}
                repositories={project.repositories.map((row) => ({
                  value: row.id,
                  label: shortName(row.fullName),
                  description: `${row.fullName} · ${row.baseBranch}`,
                  mono: true,
                }))}
                hosts={(hosts.data ?? []).map((host) => ({
                  value: host.id,
                  label: host.name,
                  description: host.online ? host.summary : t('tasks.start.offlineShort'),
                }))}
                offline={(hostId) => {
                  const host = hosts.data?.find((row) => row.id === hostId);
                  if (!host || host.online) return null;
                  return (
                    <Callout tone="warning">
                      {host.lastSeenAt ? (
                        <RelativeTime date={host.lastSeenAt}>
                          {(when) =>
                            t('tasks.start.offlineSince', { host: host.name, when: when ?? '' })
                          }
                        </RelativeTime>
                      ) : (
                        t('tasks.start.offline', { host: host.name })
                      )}
                    </Callout>
                  );
                }}
                pending={launch.isPending}
                error={launch.error ? resolveError(launch.error, t('tasks.start.failed')) : null}
                onCancel={close}
                onSubmit={(values) => {
                  const session = toStartSession(values, project);
                  if (session)
                    launch.mutate({
                      id: task.id,
                      session,
                      seenStatus: task.status,
                      idempotencyKey,
                    });
                }}
              />
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
