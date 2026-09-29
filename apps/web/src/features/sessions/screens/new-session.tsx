import { useTranslation } from 'react-i18next';
import { NewSessionForm } from '../sections/new-session-form';

/**
 * New session: the console's pane when nothing is open.
 *
 * The column is the export's `.op-newsession__inner` — 720px centred, 48px of
 * air over 32px of gutter — and what lands in it is one centred line, "Ready
 * when you are.", over the chip row and the composer
 * (`product/versions/mvp/05-screens.md`). The line is an invitation, not a
 * label, so no subtitle explains it: the chips already say where the work
 * runs. It sits on the grey `canvas-recessed` ground, as `.op-newsession` does, so the white composer
 * reads as the one surface; an open session's terminal is white edge to edge.
 *
 * The screen composes and nothing else. Every read this pane makes belongs to
 * the section below it, which is the component that renders the result.
 */
export function NewSessionScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas-recessed">
      <div className="m-auto flex w-full max-w-180 flex-col gap-4.5 px-8 py-12">
        <NewSessionForm
          heading={
            <h1 className="text-center font-display text-metric font-semibold text-fg">
              {t('sessions.new.heading')}
            </h1>
          }
        />
      </div>
    </div>
  );
}
