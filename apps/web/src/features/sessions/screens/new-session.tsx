import { ErrorAlert, usePaneDrop } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { NewSessionBackdrop } from '../components/new-session-backdrop';
import { NewSessionBackgroundMenu } from '../components/new-session-background-menu';
import { useNewSessionBackground } from '../hooks/use-new-session-background';
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
 *
 * The reader may lay an image of their own under the pane, from the button
 * in its top-right corner; it is kept on this device and shown on this
 * screen only (`lib/new-session-background.ts`).
 */
export function NewSessionScreen() {
  const { t } = useTranslation();
  const drop = useNewSessionDrop();
  usePaneDrop(drop.deliver);
  const background = useNewSessionBackground();

  return (
    <NewSessionDropContext value={drop}>
      {background.image ? <NewSessionBackdrop image={background.image} /> : null}
      <NewSessionBackgroundMenu
        hasImage={background.image !== null}
        onChoose={background.choose}
        onRemove={background.remove}
      />
      <div className="flex flex-col gap-2.5">
        {background.failure ? (
          <ErrorAlert
            message={t(`sessions.new.background.${background.failure}`)}
            onDismiss={background.dismiss}
          />
        ) : null}
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
