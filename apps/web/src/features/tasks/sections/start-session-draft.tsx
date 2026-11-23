import { Callout, DialogDescription, FieldDescription } from '@oppenheimer/design-system-web';
import {
  useCloudAgentStatus,
  useInstallationRepositoriesFor,
  useInstallations,
  useRefreshInstallations,
  useStartInstallation,
  useStartTaskSession,
  useSuspenseStartSession,
  useVoiceDictation,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import {
  ErrorAlert,
  notifySuccess,
  RelativeTime,
  useManageRepositoryAccess,
} from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StartSessionForm } from '../forms/start-session-form';
import {
  placeOptions,
  repositoriesStatusOf,
  startDefaults,
  startRepositories,
  toStartSession,
} from '../lib/start-session';

/**
 * Start session's form, in `StartSessionDialog`'s `QueryState.Data`: it reads
 * the tasks, the projects and the hosts with their presence under Suspense,
 * side by side, and finds the task it is given and its project. Whether
 * the reader has a Cursor key is read beside them, without holding the form:
 * until it answers, Cursor is offered disabled. The repositories the
 * workspace's GitHub installations reach are read the same way: the project's
 * are offered at once, the rest join them as they load, and a read that fails
 * says so under the ones that did. A task
 * or project that is gone says so instead of the form. The idempotency key is
 * this form's, so a retried submit does not start two sessions. A refetch
 * that fails keeps the form and says so above it.
 */
export function StartSessionDraft({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { tasks, projects, hosts, error } = useSuspenseStartSession();
  const { data: cloudStatus } = useCloudAgentStatus();
  const task = tasks.find((row) => row.id === taskId);
  const project = projects.find((row) => row.id === task?.projectId);
  const installations = useInstallations();
  const reachable = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const manageAccess = useManageRepositoryAccess(useStartInstallation(), useRefreshInstallations());
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const voice = useVoiceDictation(() => (project ? [project.name] : []));
  const launch = useStartTaskSession({
    onSuccess: (started) => {
      notifySuccess(
        started.hints.includes('host_offline') ? 'taskSessionQueued' : 'taskSessionStarted',
      );
      onClose();
    },
  });
  if (!task || !project)
    return (
      <>
        <ErrorAlert error={error} fallback={t('tasks.start.loadFailed')} />
        <FieldDescription>{t('tasks.dialog.gone')}</FieldDescription>
      </>
    );
  const found = { task, project, hosts };
  const repositories = startRepositories(project, reachable.repositories);

  return (
    <div className="flex flex-col gap-4">
      <DialogDescription>{t('tasks.start.for', { title: task.title })}</DialogDescription>
      <ErrorAlert error={error} fallback={t('tasks.start.loadFailed')} />
      <ErrorAlert
        error={manageAccess.error}
        fallback={t('common.repositoryAccess.failed')}
        onDismiss={manageAccess.dismiss}
      />
      <StartSessionForm
        values={startDefaults(found.task, found.project, found.hosts)}
        voice={voice}
        repositories={repositories}
        repositoriesStatus={repositoriesStatusOf([installations, reachable])}
        onManageRepositories={manageAccess.onManage}
        hosts={found.hosts.map((host) => ({
          value: host.id,
          label: host.name,
          description: host.online ? host.summary : t('tasks.start.offlineShort'),
        }))}
        cloudHosts={found.hosts.map((host) => {
          // Offline is not "cannot": the session waits for the host, as on any place.
          const cannot = host.online && host.details.startsCloud['claude-code'] === false;
          return {
            value: host.id,
            label: host.name,
            disabled: cannot,
            // The account a cloud session runs on is the host's, so each host says whose.
            description: cannot
              ? t('tasks.start.cannotStartCloud')
              : (host.details.claudeAccount ?? t('tasks.start.accountUnknown')),
          };
        })}
        account={(hostId) => {
          const host = found.hosts.find((row) => row.id === hostId);
          if (!host) return null;
          return (
            <FieldDescription>
              {host.details.claudeAccount
                ? t('tasks.start.cloudAccount', {
                    account: host.details.claudeAccount,
                    host: host.name,
                  })
                : t('tasks.start.cloudAccountUnknown', { host: host.name })}
            </FieldDescription>
          );
        }}
        places={placeOptions(t, (provider) =>
          Boolean(cloudStatus?.providers.some((row) => row.id === provider && row.connected)),
        )}
        online={(hostId) => Boolean(found.hosts.find((row) => row.id === hostId)?.online)}
        offline={(hostId) => {
          const host = found.hosts.find((row) => row.id === hostId);
          if (!host || host.online) return null;
          return (
            <Callout tone="warning">
              {host.lastSeenAt ? (
                <RelativeTime date={host.lastSeenAt}>
                  {(when) =>
                    t('tasks.start.offlineSince', {
                      host: host.name,
                      when: when ?? '',
                    })
                  }
                </RelativeTime>
              ) : (
                t('tasks.start.offline', { host: host.name })
              )}
            </Callout>
          );
        }}
        homeOffline={(hostId) => {
          const host = found.hosts.find((row) => row.id === hostId);
          if (!host) return null;
          return (
            <Callout tone="warning">{t('tasks.start.homeOffline', { host: host.name })}</Callout>
          );
        }}
        pending={launch.isPending}
        error={launch.error ? resolveError(launch.error, t('tasks.start.failed')) : null}
        onCancel={onClose}
        onSubmit={(values) => {
          const body = toStartSession(values, repositories);
          if (body)
            launch.mutate({
              id: found.task.id,
              ...body,
              seenStatus: found.task.status,
              idempotencyKey,
            });
        }}
      />
    </div>
  );
}
