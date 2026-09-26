import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import type { ProjectEntity } from '@oppenheimer/frontend-consumer';
import {
  useCreateProject,
  useHosts,
  useInstallationRepositoriesFor,
  useInstallations,
  useRepositoryBranchesFor,
} from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import type { CreateProjectDto } from '@oppenheimer/shared/schemas/project';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProjectForm } from '../forms/project-form';
import { toProjectRepositoryOptions } from '../lib/project-options';
import { toAgentOptions, toHostOptions } from '../lib/session-options';

/**
 * New project: the dialog behind the project chip's foot action.
 *
 * It owns its reads — the hosts, every connected installation's repositories,
 * and the branches of the rows that are ticked, which are read only then so a
 * list nobody has touched costs GitHub nothing — and its one write. The form
 * below is props in, values out.
 */
export function NewProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  /** The project just made, for the screen that asked for it. */
  onCreated: (project: ProjectEntity) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const hosts = useHosts();
  const installations = useInstallations();
  const repositories = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const [ticked, setTicked] = useState<CreateProjectDto['repositories']>([]);
  const branches = useRepositoryBranchesFor(ticked);
  const create = useCreateProject({ onSuccess: onCreated });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('sessions.project.newTitle')}</DialogTitle>
          <DialogDescription>{t('sessions.project.newDescription')}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ProjectForm
            repositories={toProjectRepositoryOptions(
              repositories.repositories,
              branches.byRepository,
            )}
            hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
            agents={toAgentOptions().map((agent) => ({ value: agent.id, label: agent.label }))}
            isPending={create.isPending}
            error={
              create.isError
                ? resolveError(create.error, t('sessions.project.createFailed')).message
                : undefined
            }
            submitLabel={t('sessions.project.create')}
            onRepositoriesChange={setTicked}
            onSubmit={(values) =>
              create.mutate({
                name: values.name,
                repositories: values.repositories.map((repository) => ({
                  ...repository,
                  repositoryFullName: '',
                })),
                defaultHostId: values.defaultHostId ?? null,
                defaultAgent: values.defaultAgent ?? null,
                instructions: values.instructions ?? '',
              })
            }
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
