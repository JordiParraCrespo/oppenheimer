import {
  AgentMark,
  Chip,
  DialogBody,
  DialogFooter,
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import { CODING_AGENT_IDS, CODING_AGENTS } from '@oppenheimer/shared/agents';
import type { ReactNode } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ProjectFormValues } from '../lib/project-draft';

/**
 * The project dialog's body and footer: the name; Repositories; then a
 * Defaults fold, optional, that reads what is set while closed — the host as
 * chips, the agent as chips, and Cloned by default.
 *
 * A form, so it never fetches: the pickers that list something the API holds
 * (the repositories, the hosts, the summary that names a host) are sections the
 * dialog hands in, each binding its own field and reading its own query, and
 * the footer's buttons come in the same way. What is drawn here from the form
 * alone — the name and the agent chips — binds its field here.
 */
export function ProjectForm({
  form,
  fixed,
  pending,
  alert,
  repositories,
  host,
  cloned,
  summary,
  footer,
  onSubmit,
}: {
  form: UseFormReturn<ProjectFormValues>;
  /** Unassigned: its name is the product's, shown and not edited. */
  fixed: boolean;
  pending: boolean;
  /** A failed save the fields cannot say. */
  alert: ReactNode;
  repositories: ReactNode;
  host: ReactNode;
  cloned: ReactNode;
  summary: ReactNode;
  footer: ReactNode;
  onSubmit: (values: ProjectFormValues) => void;
}) {
  const { t } = useTranslation();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-col">
      <DialogBody>
        <div className="flex flex-col gap-5.5">
          {alert}

          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="project-name">{t('projects.dialog.name')}</FieldLabel>
            {fixed ? (
              <Input id="project-name" value={t('projects.unassigned')} readOnly disabled />
            ) : (
              <Input
                {...register('name')}
                id="project-name"
                placeholder={t('projects.dialog.namePlaceholder')}
                aria-invalid={Boolean(errors.name)}
                disabled={pending}
                autoFocus
              />
            )}
            <FieldError errors={[errors.name]} />
            {fixed ? (
              <FieldDescription>{t('projects.dialog.unassignedHint')}</FieldDescription>
            ) : null}
          </Field>

          {repositories}

          <Disclosure>
            <DisclosureTrigger meta={t('projects.dialog.optional')} summary={summary}>
              {t('projects.dialog.defaults')}
            </DisclosureTrigger>
            <DisclosurePanel>
              <div className="flex flex-col gap-4.5">
                <p className="m-0 text-[13px] text-pretty text-fg-muted">
                  {t('projects.dialog.defaultsHint')}
                </p>

                {host}

                <div className="flex flex-col gap-2">
                  <span className="text-[12.5px] text-fg-muted">{t('projects.dialog.agent')}</span>
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
                            {CODING_AGENTS[agent].label}
                          </Chip>
                        ))}
                      </div>
                    )}
                  />
                </div>

                {cloned}
              </div>
            </DisclosurePanel>
          </Disclosure>
        </div>
      </DialogBody>

      <DialogFooter>{footer}</DialogFooter>
    </form>
  );
}
