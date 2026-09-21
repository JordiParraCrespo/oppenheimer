import { Button } from '@oppenheimer/design-system-web';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The console with no session open: `/sessions` itself.
 *
 * The sidebar is the list now, so this pane is not a second one — it is what
 * the artboard draws in the same place a terminal goes, and it says what the
 * pane is for: "start one and the terminal takes over this pane".
 *
 * The frame is the export's `.op-newsession`, the same one New session uses,
 * centred with the artboard's 120px of air over it: a 32px display line, a
 * 15px muted sentence under it and one primary button, 18px apart. No icon
 * disc — the pane is saying what belongs here, not reporting that a
 * collection is empty, and the artboard draws none.
 *
 * It reads the list only to know which of two sentences is true. A reader with
 * sessions came here by leaving one and is told where the others are; a reader
 * with none is being told what the product does. Neither is a list: while the
 * request is in flight the pane stays empty rather than flashing the wrong
 * sentence and correcting itself.
 */
export function SessionsScreen() {
  const { t } = useTranslation();
  const { data: sessions } = useSessions();

  if (!sessions) return null;

  const hasSessions = sessions.length > 0;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="m-auto flex w-full max-w-[720px] flex-col items-center gap-4.5 px-8 pt-30 pb-12 text-center">
        <div>
          <h1 className="font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.021em] text-fg">
            {t(hasSessions ? 'sessions.home.openTitle' : 'sessions.home.emptyTitle')}
          </h1>
          <p className="mt-1.5 text-base text-fg-muted">
            {t(hasSessions ? 'sessions.home.openDescription' : 'sessions.home.emptyDescription')}
          </p>
        </div>

        <Button render={<Link to="/sessions/new" />}>{t('nav.newSession')}</Button>
      </div>
    </div>
  );
}
