import { usePaneDrop } from '@oppenheimer/frontend-web';
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
 * The shell frames it at the `prompt` measure, at the pane's foot
 * (`routes/_authenticated/sessions/new.tsx`), and the pane takes its drops (`usePaneDrop`): files
 * dropped anywhere in the window are handed to the composer, which holds the
 * task's files, and the pane draws the outline on its own edge.
 */
export function NewSessionScreen() {
  const { t } = useTranslation();
  const drop = useNewSessionDrop();
  usePaneDrop(drop.deliver);

  return (
    <NewSessionDropContext value={drop}>
      <div className="flex flex-col gap-2.5">
        <NewSessionForm
          heading={
            <h1 className="mb-3.5 ml-1 font-display text-h2 font-semibold text-fg">
              {t('sessions.new.heading')}
            </h1>
          }
        />
      </div>
    </NewSessionDropContext>
  );
}
