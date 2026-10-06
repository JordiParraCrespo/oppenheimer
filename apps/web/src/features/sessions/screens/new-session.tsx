import { DropZone } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { NewSessionDropContext, useNewSessionDrop } from '../hooks/use-new-session-drop';
import { NewSessionForm } from '../sections/new-session-form';

/**
 * New session, the console's pane when nothing is open
 * (`product/versions/mvp/05-screens.md`, the export's `.op-newsession`), on
 * the grey ground the shell lays under every pane, so the white composer
 * reads as the one surface. The screen only composes; every read belongs to
 * the section.
 *
 * The pane is the drop zone: files dropped anywhere on it are handed to the
 * composer, which holds the task's files, and the outline traces the pane
 * while they are dragged over it. The zone is the box that does not scroll,
 * so the outline stays flush with the pane however long the form is.
 */
export function NewSessionScreen() {
  const { t } = useTranslation();
  const drop = useNewSessionDrop();

  return (
    <NewSessionDropContext value={drop}>
      <DropZone onFiles={drop.deliver} className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-1 overflow-y-auto">
          <div className="m-auto flex w-full max-w-180 flex-col gap-4.5 px-8 py-12">
            <NewSessionForm
              heading={
                <h1 className="font-display text-metric font-semibold text-fg">
                  {t('sessions.new.title')}
                </h1>
              }
            />
          </div>
        </div>
      </DropZone>
    </NewSessionDropContext>
  );
}
