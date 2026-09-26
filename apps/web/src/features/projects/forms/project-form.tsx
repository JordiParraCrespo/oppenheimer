import {
  AgentMark,
  Alert,
  AlertDescription,
  Button,
  Chip,
  Field,
  FieldDescription,
  FieldLabel,
  PageHeader,
  PageHeaderCrumbs,
  PageHeaderMeta,
  PageHeaderRow,
  PageHeaderTitleInput,
  RepositoryRowList,
  type RepositoryRowOption,
  RoutineStep,
  RoutineSteps,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { FolderKanban } from '@oppenheimer/design-system-web/icons';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { CODING_AGENT_IDS, CODING_AGENTS } from '@oppenheimer/shared/agents';
import { type CreateProjectDto, createProjectSchema } from '@oppenheimer/shared/schemas/project';
import type { ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ProjectRecap } from '../components/project-recap';
import { fromRowValue, toRowValue } from '../lib/project-rows';

/**
 * New project, as the 2026-09-26 export draws it: a page, not a dialog. The
 * name is the title, typed in place; Cancel and Create project sit on its
 * right; the line under it says what is missing, then what the project will
 * be. Below, three numbered steps down a rail — the repositories (tick to
 * include, Default to offer it to every new session, a base-branch pill per
 * row), the default host, the default agent — each ticking itself done with a
 * one-line summary.
 *
 * React Hook Form over the shared `createProjectSchema`, so the rules the API
 * holds — a name, at least one repository, one of them a default — are the
 * rules that gate the button. Props in, `onSubmit` out; the section above
 * reads the lists and saves. `onRepositoriesChange` tells it which rows are
 * ticked, because a row's branches are only read once it is.
 */
export function ProjectForm({
  crumbs,
  repositories,
  repositoriesLoading,
  hosts,
  hostsLoading,
  isPending,
  error,
  onCancel,
  onRepositoriesChange,
  onSubmit,
}: {
  crumbs: ReactNode;
  repositories: RepositoryRowOption[];
  repositoriesLoading: boolean;
  hosts: readonly { id: string; name: string }[];
  hostsLoading: boolean;
  isPending: boolean;
  error?: string;
  onCancel: () => void;
  onRepositoriesChange: (ids: string[]) => void;
  onSubmit: (values: CreateProjectDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<CreateProjectDto>({
    resolver: useZodResolver(createProjectSchema),
    mode: 'onChange',
    defaultValues: { name: '', repositories: [], defaultHostId: null, defaultAgent: null },
  });
  // The three picks, for each step's tick and summary. Not the name: that is
  // typed, and only the recap line reads it.
  const [held, defaultHostId, defaultAgent] = useWatch({
    control,
    name: ['repositories', 'defaultHostId', 'defaultAgent'],
  });
  const defaults = held.filter((repository) => repository.isDefault).length;
  const agentLabel = (agent: keyof typeof CODING_AGENTS) => CODING_AGENTS[agent].label;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col">
      <PageHeader className="mb-7">
        <PageHeaderCrumbs>{crumbs}</PageHeaderCrumbs>
        <PageHeaderRow
          icon={<FolderKanban />}
          title={
            <PageHeaderTitleInput
              {...register('name')}
              aria-label={t('projects.new.nameLabel')}
              aria-invalid={Boolean(errors.name)}
              placeholder={t('projects.new.namePlaceholder')}
              autoComplete="off"
              disabled={isPending}
              // biome-ignore lint/a11y/noAutofocus: the page exists to name a project.
              autoFocus
            />
          }
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onCancel}
                disabled={isPending}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={!isValid || isPending}>
                {isPending ? t('projects.new.creating') : t('projects.new.create')}
              </Button>
            </>
          }
        />
        <PageHeaderMeta>
          <ProjectRecap control={control} hosts={hosts} agentLabel={agentLabel} />
        </PageHeaderMeta>
      </PageHeader>

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <RoutineSteps>
        <RoutineStep
          number={1}
          title={t('projects.new.repositories.title')}
          subtitle={t('projects.new.repositories.subtitle')}
          done={held.length > 0 && defaults > 0}
          summary={t('projects.new.repositories.summary', { count: held.length, defaults })}
        >
          <Field data-invalid={Boolean(errors.repositories)}>
            <div className="flex items-baseline gap-3">
              <FieldLabel className="flex-1">{t('projects.new.repositories.defaults')}</FieldLabel>
              <span className="figures text-xs text-fg-subtle">
                {t('projects.new.repositories.defaultCount', { defaults, total: held.length })}
              </span>
            </div>
            <FieldDescription>{t('projects.new.repositories.defaultsHint')}</FieldDescription>
            {repositoriesLoading ? (
              <Skeleton className="h-50 w-full" />
            ) : (
              <Controller
                control={control}
                name="repositories"
                render={({ field }) => (
                  <RepositoryRowList
                    repositories={repositories}
                    value={toRowValue(field.value)}
                    onValueChange={(rows) => {
                      field.onChange(fromRowValue(rows, repositories));
                      onRepositoriesChange(rows.map((row) => row.id));
                    }}
                    searchPlaceholder={t('projects.new.repositories.search')}
                    emptyText={(query) =>
                      query
                        ? t('projects.new.repositories.noMatch', { query })
                        : t('projects.new.repositories.none')
                    }
                    defaultLabel={t('projects.new.repositories.default')}
                    defaultTitle={t('projects.new.repositories.defaultTitle')}
                    branchSearchPlaceholder={t('projects.new.repositories.branchSearch')}
                    branchEmptyText={(query) =>
                      t('projects.new.repositories.branchEmpty', { query })
                    }
                    branchLabel={(name) => t('projects.new.repositories.branchLabel', { name })}
                  />
                )}
              />
            )}
          </Field>
        </RoutineStep>

        <RoutineStep
          number={2}
          title={t('projects.new.host.title')}
          subtitle={t('projects.new.host.subtitle')}
          done={Boolean(defaultHostId)}
          summary={hosts.find((host) => host.id === defaultHostId)?.name}
        >
          <Controller
            control={control}
            name="defaultHostId"
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5">
                {hostsLoading ? (
                  <Skeleton className="h-7 w-24" />
                ) : hosts.length ? (
                  hosts.map((host) => (
                    <Chip
                      key={host.id}
                      selected={field.value === host.id}
                      onClick={() => field.onChange(field.value === host.id ? null : host.id)}
                    >
                      {host.name}
                    </Chip>
                  ))
                ) : (
                  <FieldDescription>{t('projects.new.host.none')}</FieldDescription>
                )}
              </div>
            )}
          />
        </RoutineStep>

        <RoutineStep
          number={3}
          last
          title={t('projects.new.agent.title')}
          subtitle={t('projects.new.agent.subtitle')}
          done={Boolean(defaultAgent)}
          summary={defaultAgent ? agentLabel(defaultAgent) : undefined}
        >
          <Controller
            control={control}
            name="defaultAgent"
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5">
                {CODING_AGENT_IDS.map((agent) => (
                  <Chip
                    key={agent}
                    selected={field.value === agent}
                    icon={<AgentMark agent={agent} />}
                    onClick={() => field.onChange(field.value === agent ? null : agent)}
                  >
                    {agentLabel(agent)}
                  </Chip>
                ))}
              </div>
            )}
          />
        </RoutineStep>
      </RoutineSteps>
    </form>
  );
}
