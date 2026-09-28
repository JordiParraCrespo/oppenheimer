import { useConsoleDialog } from '@oppenheimer/frontend-web';
import { lazy, Suspense } from 'react';

/** Each loads when first opened: the shell is on every authenticated route. */
const ProjectDialog = lazy(() =>
  import('@/features/sessions/dialogs/project').then((module) => ({
    default: module.ProjectDialog,
  })),
);
const AddHostDialog = lazy(() =>
  import('@/features/sessions/dialogs/add-host').then((module) => ({
    default: module.AddHostDialog,
  })),
);
const AutomationEditorDialog = lazy(() =>
  import('@/features/automations/dialogs/automation-editor').then((module) => ({
    default: module.AutomationEditorDialog,
  })),
);

/**
 * The console's dialogs, mounted once by the authenticated layout: whichever
 * one a surface asked for through `useConsoleDialog`, and nothing while none
 * did. App glue rather than a feature, because the three dialogs are two
 * features' and a feature never imports another.
 */
export function ConsoleDialogs() {
  const { request, close } = useConsoleDialog();
  if (!request) return null;

  return (
    <Suspense fallback={null}>
      {request.kind === 'project' ? (
        <ProjectDialog
          projectId={request.projectId}
          onClose={close}
          onSaved={(project) => {
            close();
            request.onSaved?.(project);
          }}
        />
      ) : request.kind === 'add-host' ? (
        <AddHostDialog
          onClose={close}
          onUseHost={(hostId) => {
            close();
            request.onUseHost?.(hostId);
          }}
        />
      ) : (
        <AutomationEditorDialog
          automationId={request.automationId}
          projectId={request.projectId}
          onClose={close}
          onSaved={(automation) => {
            close();
            request.onSaved?.(automation);
          }}
        />
      )}
    </Suspense>
  );
}
