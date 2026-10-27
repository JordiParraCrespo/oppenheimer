import {
  Button,
  ChipSelect,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Switch,
  Textarea,
} from '@oppenheimer/design-system-web';
import { type CloudAgentModel, repositoryNameOf } from '@oppenheimer/frontend-consumer';
import { useZodResolver } from '@oppenheimer/frontend-web';
import {
  type CloudAgentProviderId,
  type LaunchCloudAgentDto,
  type LaunchCloudAgentInput,
  launchCloudAgentSchema,
} from '@oppenheimer/shared/schemas/cloud-agent';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

/** The model picker's value for the vendor's own default: a launch then names no model. */
const AUTO = '';

/**
 * What a cloud agent is asked to do, where and on what: the prompt, a
 * repository the vendor can reach, a model (or the vendor's own pick), the
 * branch it starts from, and whether it opens a pull request. Props in,
 * `onSubmit` out; the section above fetches the pickers' options.
 */
export function LaunchCloudAgentForm({
  provider,
  providerLabel,
  repositories,
  repositoriesLoading,
  models,
  modelsLoading,
  pending,
  onSubmit,
}: {
  provider: CloudAgentProviderId;
  providerLabel: string;
  repositories: readonly string[];
  repositoriesLoading: boolean;
  models: readonly CloudAgentModel[];
  modelsLoading: boolean;
  pending: boolean;
  onSubmit: (input: LaunchCloudAgentDto) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LaunchCloudAgentInput, unknown, LaunchCloudAgentDto>({
    resolver: useZodResolver(launchCloudAgentSchema),
    defaultValues: {
      provider,
      prompt: '',
      repositoryUrl: '',
      model: undefined,
      startingRef: undefined,
      autoCreatePr: false,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <Field data-invalid={Boolean(errors.prompt)}>
          <FieldLabel htmlFor="cloudAgentPrompt">
            {t('sessions.cloudAgents.launch.prompt')}
          </FieldLabel>
          <Textarea
            {...register('prompt')}
            id="cloudAgentPrompt"
            rows={5}
            placeholder={t('sessions.cloudAgents.launch.promptPlaceholder')}
            aria-invalid={Boolean(errors.prompt)}
            disabled={pending}
          />
          <FieldError errors={[errors.prompt]} />
        </Field>
        <div className="grid gap-5 md:grid-cols-2">
          <Field data-invalid={Boolean(errors.repositoryUrl)}>
            <FieldLabel>{t('sessions.cloudAgents.launch.repository')}</FieldLabel>
            <Controller
              control={control}
              name="repositoryUrl"
              render={({ field }) => (
                <ChipSelect
                  aria-label={t('sessions.cloudAgents.launch.repository')}
                  className="self-start"
                  options={repositories.map((url) => ({
                    value: url,
                    label: repositoryNameOf(url),
                    mono: true,
                  }))}
                  value={field.value || null}
                  onValueChange={field.onChange}
                  placeholder={t('sessions.cloudAgents.launch.repositoryPlaceholder')}
                  searchPlaceholder={t('sessions.cloudAgents.launch.searchRepositories')}
                  emptyText={t('sessions.cloudAgents.launch.noRepositories')}
                  loading={repositoriesLoading}
                  loadingText={t('sessions.cloudAgents.launch.loading')}
                  disabled={pending}
                />
              )}
            />
            <FieldError errors={[errors.repositoryUrl]} />
          </Field>
          <Field>
            <FieldLabel>{t('sessions.cloudAgents.launch.model')}</FieldLabel>
            <Controller
              control={control}
              name="model"
              render={({ field }) => (
                <ChipSelect
                  aria-label={t('sessions.cloudAgents.launch.model')}
                  className="self-start"
                  options={[
                    {
                      value: AUTO,
                      label: t('sessions.cloudAgents.launch.modelDefault', {
                        provider: providerLabel,
                      }),
                    },
                    ...models.map((model) => ({
                      value: model.id,
                      label: model.label,
                      keywords: model.id,
                    })),
                  ]}
                  value={field.value ?? AUTO}
                  onValueChange={(value) => field.onChange(value === AUTO ? undefined : value)}
                  searchPlaceholder={t('sessions.cloudAgents.launch.searchModels')}
                  emptyText={t('sessions.cloudAgents.launch.noModels')}
                  loading={modelsLoading}
                  loadingText={t('sessions.cloudAgents.launch.loading')}
                  disabled={pending}
                />
              )}
            />
          </Field>
        </div>
        <Field data-invalid={Boolean(errors.startingRef)}>
          <FieldLabel htmlFor="cloudAgentRef">
            {t('sessions.cloudAgents.launch.startingRef')}
          </FieldLabel>
          <Input
            {...register('startingRef', {
              setValueAs: (value: string) => value.trim() || undefined,
            })}
            id="cloudAgentRef"
            className="font-mono"
            placeholder="main"
            autoComplete="off"
            aria-invalid={Boolean(errors.startingRef)}
            disabled={pending}
          />
          <FieldDescription>{t('sessions.cloudAgents.launch.startingRefHint')}</FieldDescription>
          <FieldError errors={[errors.startingRef]} />
        </Field>
        <Field orientation="horizontal">
          <Controller
            control={control}
            name="autoCreatePr"
            render={({ field }) => (
              <Switch
                id="cloudAgentPr"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={pending}
              />
            )}
          />
          <FieldLabel htmlFor="cloudAgentPr">
            {t('sessions.cloudAgents.launch.autoCreatePr')}
          </FieldLabel>
        </Field>
      </FieldGroup>
      <div className="flex justify-end">
        <Button
          type="submit"
          pending={pending}
          pendingLabel={t('sessions.cloudAgents.launch.submitting')}
        >
          {t('sessions.cloudAgents.launch.submit')}
        </Button>
      </div>
    </form>
  );
}
