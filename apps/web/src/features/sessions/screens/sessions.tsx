import { Button } from '@oppenheimer/design-system-web';
import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { Link, Navigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The console with no session open: `/sessions` itself.
 *
 * **A reader with no sessions is sent to the composer, not told they have
 * none.** Landing an empty workspace on a sentence and a button made the first
 * screen of the product a dead end with one way out of it; the way out is the
 * screen. So an account whose list is empty goes straight to New session, and
 * the pane below is what is left: the console someone reaches by *closing* a
 * session, who has others and is being told where they are.
 *
 * The frame is the export's `.op-newsession`, the same one New session uses,
 * centred with the artboard's 120px of air over it: a 32px display line, a
 * 15px muted sentence under it and one primary button, 18px apart. No icon
 * disc — the pane is saying what belongs here, not reporting that a
 * collection is empty, and the artboard draws none.
 *
 * Only a settled read redirects. While the request is in flight the pane stays
 * empty rather than bouncing to the composer and back, and a failed read is
 * not an empty workspace — guessing either way would move somebody off the
 * screen they asked for on a network blip.
 */
export function SessionsScreen() {
  const { t } = useTranslation();
  // Whether there are any, not the rows: the 2 s provisioning poll and a focus
  // refetch re-render this pane only when the answer flips.
  const { data: empty, isSuccess } = useSessions({ select: (rows) => rows.length === 0 });

  if (isSuccess && empty) return <Navigate to="/sessions/new" replace />;
  if (empty === undefined) return null;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas">
      <div className="m-auto flex w-full max-w-[720px] flex-col items-center gap-4.5 px-8 pt-30 pb-12 text-center">
        <div>
          <h1 className="font-display text-[32px] leading-[1.1] font-semibold tracking-[-0.021em] text-fg">
            {t('sessions.home.openTitle')}
          </h1>
          <p className="mt-1.5 text-base text-fg-muted">{t('sessions.home.openDescription')}</p>
        </div>

        <Button render={<Link to="/sessions/new" />}>{t('nav.newSession')}</Button>
      </div>
    </div>
  );
}
