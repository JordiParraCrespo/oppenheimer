import {
  Alert,
  AlertDescription,
  DialogBody,
  DialogHeader,
  DialogTitle,
  useNow,
} from '@oppenheimer/design-system-web';
import { parseRepositoryKey } from '@oppenheimer/frontend-consumer';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import {
  type ResolvedErrorMessage,
  useServerFieldErrors,
  useZodResolver,
} from '@oppenheimer/frontend-web';
import {
  type AutomationTaskDto,
  automationTaskSchema,
} from '@oppenheimer/shared/schemas/automation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { EditorFooter } from '../components/editor-footer';
import { type EditorStep, EditorSteps } from '../components/editor-steps';
import { AutomationTaskFields } from '../forms/automation-task-fields';
import { type AutomationDraft, draftRepoIds, fitCards, whereGap } from '../lib/automation-draft';
import { EditorTriggerStep } from './editor-trigger-step';
import { EditorWhereStep } from './editor-where-step';

/**
 * The automation editor's three steps inside its dialog (the 2026-09-27
 * export): Task, Trigger, Where it runs, with the strip of steps above and
 * the footer that walks them. The typed fields are the form's; what is
 * picked is the draft's. The dialog around it loads what an edit starts from
 * and owns the save.
 */
export function AutomationEditor({
  initialDraft,
  initialTask,
  editing,
  saving,
  failure,
  onCancel,
  onSubmit,
}: {
  initialDraft: AutomationDraft;
  initialTask: AutomationTaskDto;
  editing: boolean;
  saving: boolean;
  /** What the last save could not do, already in words, with the fields it names. */
  failure: ResolvedErrorMessage | null;
  onCancel: () => void;
  onSubmit: (draft: AutomationDraft, task: AutomationTaskDto) => void;
}) {
  const { t } = useTranslation();
  const now = useNow(60_000);
  const [step, setStep] = useState<EditorStep>('task');
  const [draft, setDraft] = useState(initialDraft);
  const { data: project } = useProjects({
    select: (rows) => rows.find((row) => row.id === draft.projectId),
  });
  const form = useForm<AutomationTaskDto>({
    resolver: useZodResolver(automationTaskSchema),
    defaultValues: initialTask,
  });
  // The task's fields the server refused are marked on the fields themselves.
  useServerFieldErrors(form, failure);

  const repoIds = draftRepoIds(draft);
  const repositories = repoIds.map((id) => ({
    id,
    name:
      project?.repositories
        .find((repository) => Number(repository.githubRepoId) === id)
        ?.fullName.split('/')
        .pop() ?? String(id),
  }));
  const triggerDone = draft.triggers.length > 0;
  const whereDone = whereGap(draft) === null;

  const patchWhere = (patch: Partial<AutomationDraft>) =>
    setDraft((current) => {
      const next = { ...current, ...patch };
      // A GitHub card listens only where the automation works.
      return patch.repositoryKeys
        ? {
            ...next,
            triggers: fitCards(
              next.triggers,
              next.repositoryKeys.flatMap((key) => {
                const ref = parseRepositoryKey(key);
                return ref ? [Number(ref.githubRepoId)] : [];
              }),
            ),
          }
        : next;
    });

  return (
    <form
      noValidate
      className="contents"
      onSubmit={form.handleSubmit((task) => onSubmit(draft, task))}
    >
      <DialogHeader>
        <DialogTitle>
          {editing ? t('automations.editor.editTitle') : t('automations.editor.newTitle')}
        </DialogTitle>
      </DialogHeader>
      <EditorSteps
        step={step}
        control={form.control}
        triggerDone={triggerDone}
        whereDone={whereDone}
        onStepChange={setStep}
      />
      {/* A floor so the dialog keeps its height across steps, on a screen
          tall enough for it; below that the body shrinks and scrolls, so the
          footer's buttons stay reachable. */}
      <DialogBody className="[@media(min-height:720px)]:min-h-75">
        {failure ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{failure.message}</AlertDescription>
          </Alert>
        ) : null}
        {step === 'task' ? (
          <AutomationTaskFields
            register={form.register}
            errors={form.formState.errors}
            autoFocus={!editing}
          />
        ) : step === 'trigger' ? (
          <EditorTriggerStep
            triggers={draft.triggers}
            repositories={repositories}
            now={now}
            onChange={(triggers) => setDraft((current) => ({ ...current, triggers }))}
          />
        ) : (
          <EditorWhereStep draft={draft} onChange={patchWhere} />
        )}
      </DialogBody>
      <EditorFooter
        step={step}
        control={form.control}
        triggerDone={triggerDone}
        whereDone={whereDone}
        editing={editing}
        saving={saving}
        onStepChange={setStep}
        onCancel={onCancel}
      />
    </form>
  );
}
