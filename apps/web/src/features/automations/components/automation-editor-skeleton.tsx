import {
  Button,
  DialogBody,
  DialogFooter,
  Field,
  FieldDescription,
  FieldLabel,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { EditorStepTabs } from './editor-step-tabs';

const NOTHING_DONE = { task: false, trigger: false, where: false } as const;

/**
 * The automation editor's body and foot before what it starts from has
 * answered, under the dialog's header: the step tabs on the Task step, the
 * body at the floor the editor keeps, the Name and Prompt fields with their
 * labels and hint written and the controls at their heights, and the foot's
 * Cancel and Next drawn disabled.
 */
export function AutomationEditorSkeleton() {
  const { t } = useTranslation();
  return (
    <>
      <EditorStepTabs step="task" done={NOTHING_DONE} />
      <DialogBody aria-busy className="[@media(min-height:720px)]:min-h-75">
        <LoadingStatus />
        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel>{t('automations.editor.name')}</FieldLabel>
            <Skeleton shape="sm" className="h-(--control-h-md) w-full" />
          </Field>
          <Field>
            <FieldLabel>{t('automations.editor.prompt')}</FieldLabel>
            {/* A block stands in here: the prompt's textarea, at the editor's min-h-28. */}
            <Skeleton shape="sm" className="h-28 w-full" />
            <FieldDescription>{t('automations.editor.promptHint')}</FieldDescription>
          </Field>
        </div>
      </DialogBody>
      <DialogFooter className="items-center">
        <span className="min-w-0 flex-1" />
        <Button type="button" variant="secondary" disabled>
          {t('common.cancel')}
        </Button>
        <Button type="button" disabled>
          {t('automations.editor.next')}
        </Button>
      </DialogFooter>
    </>
  );
}
