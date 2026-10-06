import {
  AgentModelSelect,
  Button,
  ChipSelect,
  type ChipSelectOption,
  Field,
  FieldLabel,
  Textarea,
} from '@oppenheimer/design-system-web';
import { Cpu, GitBranch } from '@oppenheimer/design-system-web/icons';
import { ErrorAlert, type ResolvedErrorMessage } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toAgentOptions } from '../lib/agent-options';
import { asAgent, type StartSessionValues } from '../lib/start-session';

/**
 * The launch dialog's form (`18-plan-product.md` §4): the prompt, prefilled
 * from the task, and the repository, host, agent and model, defaulted from the
 * project. ⌘↩ starts. `offline` is the note for a host that is away, and the
 * button then reads Queue session.
 *
 * Validated with React Hook Form's own rules: the body the API checks is built
 * from these choices (`toStartSession`), not typed into them.
 */
export function StartSessionForm({
  values,
  repositories,
  hosts,
  offline,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  values: StartSessionValues;
  repositories: ChipSelectOption[];
  hosts: ChipSelectOption[];
  /** The note under the pickers when the picked host is offline. */
  offline: (hostId: string) => ReactNode;
  pending: boolean;
  error: ResolvedErrorMessage | null;
  onSubmit: (values: StartSessionValues) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit } = useForm<StartSessionValues>({ values });
  const hostId = useWatch({ control, name: 'hostId' });
  const note = hostId ? offline(hostId) : null;
  const submit = handleSubmit(onSubmit);

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          void submit();
        }
      }}
    >
      <Field>
        <FieldLabel htmlFor="start-prompt">{t('tasks.start.prompt')}</FieldLabel>
        <Textarea {...register('prompt')} id="start-prompt" rows={5} />
      </Field>
      <div className="flex flex-wrap items-center gap-2">
        <Controller
          control={control}
          name="repositoryId"
          rules={{ required: true }}
          render={({ field }) => (
            <ChipSelect
              value={field.value}
              onValueChange={field.onChange}
              options={repositories}
              icon={<GitBranch />}
              aria-label={t('tasks.start.repository')}
              placeholder={t('tasks.start.repositoryPlaceholder')}
              searchPlaceholder={t('tasks.start.repositorySearch')}
              emptyText={t('tasks.start.noRepositories')}
            />
          )}
        />
        <Controller
          control={control}
          name="hostId"
          rules={{ required: true }}
          render={({ field }) => (
            <ChipSelect
              value={field.value}
              onValueChange={field.onChange}
              options={hosts}
              icon={<Cpu />}
              aria-label={t('tasks.start.host')}
              placeholder={t('tasks.start.hostPlaceholder')}
              searchPlaceholder={t('tasks.start.hostSearch')}
              emptyText={t('tasks.start.noHosts')}
            />
          )}
        />
        <Controller
          control={control}
          name="agent"
          render={({ field }) => (
            <Controller
              control={control}
              name="model"
              render={({ field: model }) => (
                <AgentModelSelect
                  agents={toAgentOptions()}
                  value={{ agent: field.value, model: model.value }}
                  onValueChange={(next) => {
                    const agent = asAgent(next.agent);
                    if (!agent) return;
                    field.onChange(agent);
                    model.onChange(next.model);
                  }}
                  aria-label={t('tasks.start.agent')}
                  searchPlaceholder={t('tasks.start.agentSearch')}
                  emptyText={(query) => t('tasks.start.agentEmpty', { query })}
                />
              )}
            />
          )}
        />
      </div>
      {note}
      <ErrorAlert message={error?.message} correlationId={error?.correlationId} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" pending={pending} disabled={!repositories.length || !hosts.length}>
          {note ? t('tasks.start.queue') : t('tasks.start.start')}
        </Button>
      </div>
    </form>
  );
}
