import { useTranslation } from 'react-i18next';
import { NewSessionForm } from '../sections/new-session-form';

/**
 * New session: the console's pane when nothing is open.
 *
 * The column is the export's `.op-newsession__inner` — 720px centred, 48px of
 * air over 32px of gutter — and what lands in it is the chip row and the
 * composer (`product/versions/mvp/05-screens.md`).
 *
 * The screen composes and nothing else. Every read this pane makes belongs to
 * the section below it, which is the component that renders the result.
 */
export function NewSessionScreen() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="m-auto flex w-full max-w-[720px] flex-col gap-4.5 px-8 py-12">
        <div>
          <h1 className="font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.021em] text-fg">
            {t('sessions.new.title')}
          </h1>
          <p className="mt-1.5 text-base text-fg-muted">{t('sessions.new.subtitle')}</p>
        </div>

        <NewSessionForm />
      </div>
    </div>
  );
}
