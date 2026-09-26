import {
  Button,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSelect,
  Input,
  RepositoryRowList,
  Textarea,
} from '@oppenheimer/design-system-web';
import { useZodResolver } from '@oppenheimer/frontend-web';
import { type CreateProjectDto, createProjectSchema } from '@oppenheimer/shared/schemas/project';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  type ProjectRepositoryOption,
  toProjectRepositoryRows,
  toProjectRepositoryValue,
} from '../lib/project-options';

/**
 * New project: a name, the repositories its sessions usually work on (each on a
 * base branch, and whether a new session is offered it), a default host and
 * agent, and instructions for the agent.
 *
 * React Hook Form over the shared `createProjectSchema`, so the rules the API
 * holds — at least one repository, one of them a default — are the rules the
 * dialog shows. Props in, `onSubmit` out; the dialog above fetches and saves.
 * `onRepositoriesChange` tells it which rows are ticked, because a row's
 * branches are only read once it is.
 */
export function ProjectForm({
  repositories,
  hosts,
  agents,
  defaultValues,
  isPending,
  error,
  submitLabel,
  onRepositoriesChange,
  onSubmit,
}: {
  repositories: ProjectRepositoryOption[];
  hosts: { value: string; label: string; description?: string }[];
  agents: { value: string; label: string }[];
  defaultValues?: Partial<CreateProjectDto>;
  isPending: boolean;
  error?: string;
  submitLabel: string;
  onRepositoriesChange: (value: CreateProjectDto['repositories']) => void;
  onSubmit: (values: CreateProjectDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateProjectDto>({
    resolver: useZodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      repositories: [],
      defaultHostId: null,
      defaultAgent: null,
      instructions: '',
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name)}>
          <FieldLabel htmlFor="project-name">{t('sessions.project.name')}</FieldLabel>
          <Input
            {...register('name')}
            id="project-name"
            autoComplete="off"
            placeholder={t('sessions.project.namePlaceholder')}
            aria-invalid={Boolean(errors.name)}
            disabled={isPending}
          />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field data-invalid={Boolean(errors.repositories)}>
          <FieldLabel>{t('sessions.project.repositories')}</FieldLabel>
          <Controller
            control={control}
            name="repositories"
            render={({ field }) => (
              <RepositoryRowList
                repositories={toProjectRepositoryRows(repositories)}
                value={toProjectRepositoryValue(field.value)}
                onValueChange={(rows) => {
                  const next = rows.flatMap((row) => {
                    const option = repositories.find((repository) => repository.id === row.id);
                    return option
                      ? [
                          {
                            installationId: option.installationId,
                            githubRepoId: option.githubRepoId,
                            baseBranch: row.branch,
                            isDefault: row.isDefault,
                          },
                        ]
                      : [];
                  });
                  field.onChange(next);
                  onRepositoriesChange(next);
                }}
                searchPlaceholder={t('sessions.new.repository.search')}
                emptyText={() => t('sessions.new.repository.empty')}
                defaultLabel={t('sessions.project.default')}
                defaultTitle={t('sessions.project.defaultTitle')}
                branchSearchPlaceholder={t('sessions.new.branch.search')}
                branchEmptyText={() => t('sessions.new.branch.empty')}
                branchLabel={(name) => t('sessions.new.repository.branchPane', { name })}
              />
            )}
          />
          <FieldError>
            {errors.repositories ? t('sessions.project.repositoriesRequired') : null}
          </FieldError>
        </Field>

        <Field>
          <FieldLabel>{t('sessions.project.defaultHost')}</FieldLabel>
          <Controller
            control={control}
            name="defaultHostId"
            render={({ field }) => (
              <FieldSelect
                options={hosts}
                value={field.value ?? null}
                onValueChange={field.onChange}
                placeholder={t('sessions.project.none')}
                searchPlaceholder={t('sessions.new.host.search')}
                aria-label={t('sessions.project.defaultHost')}
              />
            )}
          />
        </Field>

        <Field>
          <FieldLabel>{t('sessions.project.defaultAgent')}</FieldLabel>
          <Controller
            control={control}
            name="defaultAgent"
            render={({ field }) => (
              <FieldSelect
                options={agents}
                value={field.value ?? null}
                onValueChange={(value) => field.onChange(value as CreateProjectDto['defaultAgent'])}
                placeholder={t('sessions.project.none')}
                aria-label={t('sessions.project.defaultAgent')}
              />
            )}
          />
        </Field>

        <Field data-invalid={Boolean(errors.instructions)}>
          <FieldLabel htmlFor="project-instructions">
            {t('sessions.project.instructions')}
          </FieldLabel>
          <Textarea
            {...register('instructions')}
            id="project-instructions"
            rows={4}
            placeholder={t('sessions.project.instructionsPlaceholder')}
            aria-invalid={Boolean(errors.instructions)}
            disabled={isPending}
          />
          <FieldError errors={[errors.instructions]} />
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isPending}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
