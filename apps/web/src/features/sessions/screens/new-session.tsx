import { useTranslation } from 'react-i18next';
import { NewSessionForm } from '../sections/new-session-form';

/**
 * New session, the console's pane when nothing is open
 * (`product/versions/mvp/05-screens.md`, the export's `.op-newsession`). It
 * sits on the grey `canvas-recessed` ground so the white composer reads as the
 * one surface. The screen only composes; every read belongs to the section.
 *
 * The outer box is `relative` and does not scroll: it is the pane the
 * composer's drop outline traces while files are dragged over the page.
 */
export function NewSessionScreen() {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas-recessed">
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
    </div>
  );
}
