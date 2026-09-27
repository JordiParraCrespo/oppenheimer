import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldDescription,
  FieldLabel,
  Input,
  Textarea,
} from '@oppenheimer/design-system-web';
import { useProjects } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * New automation (`product/versions/mvp/13-automations.md`): a dialog over
 * the console, opened from the sidebar's button, a project header's plus
 * and the overview's button.
 *
 * The frame draws a three-step wizard — Task, Trigger, Where it runs. Until
 * the API names a trigger, only the first step exists: the name and what
 * the agent should do, live, with the project it was opened for named
 * under them; the footer says the rest is coming and Create stays off.
 * The strip of steps and the pickers arrive with the resource, not before.
 */
export function AutomationEditorDialog({
  projectId,
  onClose,
}: {
  /** The project a header's plus opened it for. */
  projectId?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  // The named project, for the line under the fields. Read here rather than
  // handed in: three surfaces open this, and none holds the row.
  const { data: project } = useProjects({
    select: (rows) => rows.find((row) => row.id === projectId),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('automations.editor.newTitle')}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-5">
            <Field>
              <FieldLabel htmlFor="automation-name">{t('automations.editor.name')}</FieldLabel>
              <Input
                id="automation-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('automations.editor.namePlaceholder')}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="automation-prompt">{t('automations.editor.prompt')}</FieldLabel>
              <Textarea
                id="automation-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t('automations.editor.promptPlaceholder')}
                className="min-h-28"
              />
              <FieldDescription>{t('automations.editor.promptHint')}</FieldDescription>
            </Field>
            {project ? (
              <FieldDescription>
                {t('automations.editor.forProject', { name: project.name })}
              </FieldDescription>
            ) : null}
          </div>
        </DialogBody>

        <DialogFooter className="items-center">
          <span className="min-w-0 flex-1 text-[12.5px] text-pretty text-fg-muted">
            {t('automations.editor.soon')}
          </span>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" disabled>
            {t('automations.editor.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
