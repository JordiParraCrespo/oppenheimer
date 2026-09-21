import { EmptyState } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * New session: the console's pane when nothing is open.
 *
 * The column is the export's `.op-newsession__inner` — 720px centred, 48px of
 * air over 32px of gutter — so what lands in it later lands where the artboard
 * draws it: the chips for host, repository and branch, and the composer for
 * the first task (`product/versions/mvp/05-screens.md`). Those arrive with the
 * create-session wiring; `useCreateSession` and `useHosts` in
 * `@oppenheimer/frontend-consumer` already take their input.
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
          <p className="mt-1.5 text-lg text-fg-muted">{t('sessions.new.subtitle')}</p>
        </div>

        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Media variant="icon">
              <Plus />
            </EmptyState.Media>
            <EmptyState.Title>{t('sessions.new.emptyTitle')}</EmptyState.Title>
            <EmptyState.Description>{t('sessions.new.emptyDescription')}</EmptyState.Description>
          </EmptyState.Header>
        </EmptyState>
      </div>
    </div>
  );
}
