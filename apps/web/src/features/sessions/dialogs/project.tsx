import {
  AgentMark,
  Alert,
  AlertDescription,
  Button,
  Chip,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  RepositoryRowList,
  type RepositoryRowValue,
  Skeleton,
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
import { useZodResolver } from '@oppenheimer/frontend-web';
import { CODING_AGENT_IDS, CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import { createProjectSchema } from '@oppenheimer/shared/schemas/project';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  parseRepositoryKey,
  toProjectRepositoryInputs,
  toProjectRepositoryRows,
} from '../lib/session-options';

/** The one field the form validates; the rest of the dialog is picked, not typed. */
const nameSchema = createProjectSchema.pick({ name: true });
type NameValues = { name: string };

/**
 * New project — the dialog behind the project chip's foot row
 * (`product/versions/mvp/12-projects-on-the-console.md`).
 *
 * The export's dialog, and the console's second one: a name, the repository
 * rows (tick to include, mark Default to clone into every new session, a
 * base-branch pill per row), the default host as chips, the default agent as
 * chips. It owns its mutation and its three reads, because it is the
 * component that renders each result: the installations' repositories are
 * the rows, the branches of the ticked rows are the pills, the hosts are the
 * chips. The branches are deliberately late, as on the scope chip — a call
 * per row nobody ticked is a rate limit spent on nothing.
 *
 * What leaves is the created project, so the section can select it and let
 * its defaults prefill the other chips.
 */
export function ProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: ProjectEntity) => void;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const [rows, setRows] = useState<RepositoryRowValue[]>([]);
  const [defaultHostId, setDefaultHostId] = useState<string | null>(null);
  const [defaultAgent, setDefaultAgent] = useState<CodingAgentId | null>(null);

  const hosts = useHosts();
  const installations = useInstallations();
  const repositories = useInstallationRepositoriesFor(
    (installations.data ?? []).map((installation) => installation.id),
  );
  const ticked = rows.flatMap((row) => {
    const ref = parseRepositoryKey(row.id);
    return ref ? [ref] : [];
  });
  const branches = useRepositoryBranchesFor(ticked);
  const options = toProjectRepositoryRows(repositories.repositories, branches.byRepository);
  const defaultBranches = new Map(options.map((option) => [option.id, option.defaultBranch]));

  const create = useCreateProject({ onSuccess: onCreated });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NameValues>({
    resolver: useZodResolver(nameSchema),
    defaultValues: { name: '' },
  });

  function submit(values: NameValues) {
    create.mutate({
      name: values.name.trim(),
      repositories: toProjectRepositoryInputs(rows, defaultBranches),
      defaultHostId,
      defaultAgent,
    });
  }

  const defaults = rows.filter((row) => row.isDefault).length;
  const loadingRows = installations.isPending || repositories.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} className="sm:max-w-135">
        <form onSubmit={handleSubmit(submit)} noValidate>
          <DialogHeader>
            <DialogTitle>{t('sessions.new.projectDialog.title')}</DialogTitle>
            <DialogDescription>{t('sessions.new.projectDialog.description')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="flex flex-col gap-4.5">
              {create.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>
                    {resolveError(create.error, t('sessions.new.projectDialog.failed')).message}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="project-name">
                  {t('sessions.new.projectDialog.name')}
                </FieldLabel>
                <Input
                  {...register('name')}
                  id="project-name"
                  placeholder={t('sessions.new.projectDialog.namePlaceholder')}
                  aria-invalid={Boolean(errors.name)}
                  disabled={create.isPending}
                  autoFocus
                />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field>
                <div className="flex items-baseline gap-2">
                  <FieldLabel className="flex-1">
                    {t('sessions.new.projectDialog.repositories')}
                  </FieldLabel>
                  <span className="figures text-xs text-fg-subtle">
                    {t('sessions.new.projectDialog.defaultCount', {
                      defaults,
                      count: rows.length,
                    })}
                  </span>
                </div>
                <FieldDescription>{t('sessions.new.projectDialog.repositoriesHint')}</FieldDescription>
                {loadingRows ? (
                  <Skeleton className="h-30 w-full" />
                ) : (
                  <RepositoryRowList
                    repositories={options}
                    value={rows}
                    onValueChange={setRows}
                    searchPlaceholder={t('sessions.new.projectDialog.search')}
                    emptyText={(query) =>
                      query
                        ? t('sessions.new.projectDialog.noMatch', { query })
                        : t('sessions.new.projectDialog.noRepositories')
                    }
                    defaultLabel={t('sessions.new.projectDialog.default')}
                    defaultTitle={t('sessions.new.projectDialog.defaultTitle')}
                    branchSearchPlaceholder={t('sessions.new.repository.branchSearch')}
                    branchEmptyText={(query) =>
                      t('sessions.new.projectDialog.branchEmpty', { query })
                    }
                    branchLabel={(name) => t('sessions.new.repository.branchPane', { name })}
                  />
                )}
              </Field>

              <Field>
                <FieldLabel>{t('sessions.new.projectDialog.host')}</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {hosts.isPending ? (
                    <Skeleton className="h-7 w-24" />
                  ) : hosts.data?.length ? (
                    hosts.data.map((host) => (
                      <Chip
                        key={host.id}
                        selected={defaultHostId === host.id}
                        onClick={() =>
                          setDefaultHostId((current) => (current === host.id ? null : host.id))
                        }
                      >
                        {host.name}
                      </Chip>
                    ))
                  ) : (
                    <FieldDescription>{t('sessions.new.projectDialog.noHost')}</FieldDescription>
                  )}
                </div>
              </Field>

              <Field>
                <FieldLabel>{t('sessions.new.projectDialog.agent')}</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {CODING_AGENT_IDS.map((agent) => (
                    <Chip
                      key={agent}
                      selected={defaultAgent === agent}
                      icon={<AgentMark agent={agent} />}
                      onClick={() =>
                        setDefaultAgent((current) => (current === agent ? null : agent))
                      }
                    >
                      {CODING_AGENTS[agent].label}
                    </Chip>
                  ))}
                </div>
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={create.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending
                ? t('sessions.new.projectDialog.creating')
                : t('sessions.new.projectDialog.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
