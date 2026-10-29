import {
  AgentModelSelect,
  Button,
  Callout,
  ChipSelect,
  type ChipSelectOption,
  Field,
  FieldLabel,
  Textarea,
} from '@oppenheimer/design-system-web';
import { Cloud, Cpu, GitBranch } from '@oppenheimer/design-system-web/icons';
import {
  DictationField,
  dictateIntoField,
  ErrorAlert,
  type ResolvedErrorMessage,
  type VoiceInput,
} from '@oppenheimer/frontend-web';
import { AUTOMATION_PLACE_RULES, isVendorPlace } from '@oppenheimer/shared/automations';
import type { ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { defaultModelFor, toAgentOptions } from '../lib/agent-options';
import { agentFor, asAgent, asPlace, type StartSessionValues } from '../lib/start-session';

/**
 * The launch dialog's form (`18-plan-product.md` §4): the prompt, prefilled
 * from the task, and the repository, where it runs, the host, agent and model,
 * defaulted from the project. Where is a host, Claude Code's cloud started
 * from a host (Claude Code only), or Cursor's cloud with no host (Cursor's
 * own agent and pick of model, offered once the reader has a key); a cloud
 * session needs a task; in Claude Code's cloud each host names the claude.ai
 * account it would run on, and the picked one is said under the chips. ⌘↩ starts. `offline` is the note for a host that is
 * away, and the button then reads Queue session. The prompt can be dictated.
 *
 * Validated with React Hook Form's own rules: the body the API checks is built
 * from these choices (`toStartSession`), not typed into them.
 */
export function StartSessionForm({
  values,
  repositories,
  hosts,
  cloudHosts,
  places,
  offline,
  account,
  voice,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  values: StartSessionValues;
  repositories: ChipSelectOption[];
  hosts: ChipSelectOption[];
  /** The hosts as a place whose host only starts the session lists them: each with its claude.ai account. */
  cloudHosts: ChipSelectOption[];
  /** Where it can run: a host, Claude Code's cloud, Cursor's; one that cannot now is disabled. */
  places: ChipSelectOption[];
  /** The note under the pickers when the picked host is offline. */
  offline: (hostId: string) => ReactNode;
  /** The line naming the claude.ai account a session the picked host starts runs on. */
  account: (hostId: string) => ReactNode;
  voice: VoiceInput;
  pending: boolean;
  error: ResolvedErrorMessage | null;
  onSubmit: (values: StartSessionValues) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const { register, control, handleSubmit, getValues, setValue } = useForm<StartSessionValues>({
    values,
  });
  const hostId = useWatch({ control, name: 'hostId' });
  const place = useWatch({ control, name: 'place' });
  const prompt = useWatch({ control, name: 'prompt' });
  const rule = AUTOMATION_PLACE_RULES[place];
  const note = hostId && rule.host ? offline(hostId) : null;
  // A cloud session starts on a task; a host session may start on nothing.
  const needsTask = rule.host !== 'runs' && !prompt.trim();
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
        <DictationField voice={voice} onText={dictateIntoField({ getValues, setValue }, 'prompt')}>
          <Textarea {...register('prompt')} id="start-prompt" rows={5} />
        </DictationField>
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
          name="place"
          render={({ field }) => (
            <ChipSelect
              value={field.value}
              onValueChange={(value) => {
                const next = asPlace(value);
                if (!next) return;
                const leftVendor = isVendorPlace(field.value);
                field.onChange(next);
                const agent = agentFor(next, getValues('agent'));
                // A model of another agent, or of the vendor's, does not carry over.
                if (isVendorPlace(next)) setValue('model', null);
                else if (agent !== getValues('agent') || leftVendor) {
                  setValue('agent', agent);
                  setValue('model', defaultModelFor(agent));
                }
              }}
              options={places}
              icon={<Cloud />}
              aria-label={t('tasks.start.where')}
              placeholder={t('tasks.start.where')}
              searchPlaceholder={t('tasks.start.whereSearch')}
              emptyText={t('tasks.start.noPlaces')}
            />
          )}
        />
        {rule.host === null ? null : (
          <Controller
            control={control}
            name="hostId"
            rules={{ required: true }}
            render={({ field }) => (
              <ChipSelect
                value={field.value}
                onValueChange={field.onChange}
                options={rule.host === 'starts' ? cloudHosts : hosts}
                icon={<Cpu />}
                aria-label={t('tasks.start.host')}
                placeholder={t('tasks.start.hostPlaceholder')}
                searchPlaceholder={t('tasks.start.hostSearch')}
                emptyText={t('tasks.start.noHosts')}
              />
            )}
          />
        )}
        {rule.host === null ? null : (
          <Controller
            control={control}
            name="agent"
            render={({ field }) => (
              <Controller
                control={control}
                name="model"
                render={({ field: model }) => (
                  <AgentModelSelect
                    // A place that names its agent offers that one alone.
                    agents={toAgentOptions().filter(
                      (option) => rule.agent === null || option.id === rule.agent,
                    )}
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
        )}
      </div>
      {hostId && rule.host === 'starts' ? account(hostId) : null}
      {needsTask ? <Callout>{t('tasks.start.cloudNeedsTask')}</Callout> : null}
      {note}
      <ErrorAlert message={error?.message} correlationId={error?.correlationId} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          pending={pending}
          disabled={!repositories.length || (rule.host !== null && !hosts.length) || needsTask}
        >
          {note ? t('tasks.start.queue') : t('tasks.start.start')}
        </Button>
      </div>
    </form>
  );
}
