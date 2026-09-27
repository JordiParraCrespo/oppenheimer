import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
} from '@oppenheimer/design-system-web';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * New automation: a dialog over the console
 * (`design/version1/SessionsConsole.dc.html`, the `r-title` dialog), opened
 * from New automation in the automations sidebar and the overview, and from
 * a project group's plus with that project as its context. It has no address:
 * the trigger holds it open.
 *
 * Only what the editor page had is here — the title, the name (not yet
 * kept), a recap line, Cancel and a Create that stays off. The frame's steps
 * (Task, Trigger, Where it runs), the fields in them and the save arrive with
 * the automations API (`product/versions/mvp/13-automations.md`); drawing
 * them before there is anything to save would be a facade. `project` is
 * where the dialog was opened from, kept for the Where step.
 */
export function NewAutomationDialog({
  onClose,
}: {
  /** The project a group's plus opened it for; the Where step reads it. */
  project?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const nameId = useId();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{t('automations.editor.newTitle')}</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <Field>
            <FieldLabel htmlFor={nameId}>{t('automations.editor.name')}</FieldLabel>
            <Input id={nameId} placeholder={t('automations.editor.namePlaceholder')} disabled />
          </Field>
        </DialogBody>

        <DialogFooter className="sm:items-center">
          <span className="min-w-0 flex-1 text-[12.5px] text-pretty text-fg-muted">
            {t('automations.editor.recap')}
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
