import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@oppenheimer/design-system-web';
import { ErrorAlert, QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { AutomationEditorSkeleton } from '../components/automation-editor-skeleton';
import { EditAutomation } from '../sections/edit-automation';
import { NewAutomation } from '../sections/new-automation';

/**
 * New automation and Edit automation (`product/versions/mvp/13-automations.md`):
 * a dialog over the console, opened from the sidebar's button, a project
 * header's plus, the overview's button, a row's Edit and a page's Edit.
 *
 * What the editor starts from — the automation being edited, or the projects
 * and hosts a new one is prefilled from — is read under Suspense, so the draft
 * is seeded once; this draws the dialog's placeholder and a first failure. A
 * save that fails keeps the dialog open with the reason; one that lands
 * closes it.
 */
export function AutomationEditorDialog({
  automationId,
  projectId,
  onClose,
  onSaved,
}: {
  automationId?: string;
  projectId?: string;
  onClose: () => void;
  onSaved: (automation: { id: string }) => void;
}) {
  const { t } = useTranslation();
  const header = (
    <DialogHeader>
      <DialogTitle>
        {automationId ? t('automations.editor.editTitle') : t('automations.editor.newTitle')}
      </DialogTitle>
    </DialogHeader>
  );

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" closeLabel={t('common.close')}>
        <QueryState>
          <QueryState.Pending>
            {header}
            <AutomationEditorSkeleton />
          </QueryState.Pending>
          <QueryState.Error>
            {(error, retry) => (
              <>
                {header}
                <DialogBody>
                  <ErrorAlert
                    error={error}
                    fallback={t(
                      automationId
                        ? 'automations.detail.loadFailed'
                        : 'automations.editor.loadFailed',
                    )}
                    action={
                      <Button variant="ghost" size="sm" onClick={retry}>
                        {t('common.retry')}
                      </Button>
                    }
                  />
                </DialogBody>
              </>
            )}
          </QueryState.Error>
          <QueryState.Data>
            {automationId ? (
              <EditAutomation automationId={automationId} onClose={onClose} onSaved={onSaved} />
            ) : (
              <NewAutomation projectId={projectId} onClose={onClose} onSaved={onSaved} />
            )}
          </QueryState.Data>
        </QueryState>
      </DialogContent>
    </Dialog>
  );
}
