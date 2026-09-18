import { Button } from '@oppenheimer/design-system-web';
import { PageHead } from '@oppenheimer/frontend-web';
import { getRouteApi, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { SessionTerminal } from '../sections/session-terminal';

const route = getRouteApi('/_authenticated/sessions/$sessionId');

/**
 * One session: the terminal, full width, with the window strip and status line
 * around it.
 *
 * The pane is a fixed height rather than the full-bleed surface
 * `product/versions/mvp/05-screens.md` describes, because `AppShell` gives
 * every screen a scrolling, padded, 1080px-capped column. Full bleed is a
 * shell change — an opt-out the shell offers and this route takes — and it is
 * worth doing on its own rather than inside the diff that lands the terminal.
 */
export function SessionScreen() {
  const { t } = useTranslation();
  const { sessionId } = route.useParams();

  return (
    <>
      <PageHead
        title={sessionId}
        sub={t('sessions.session.subtitle')}
        action={
          <Button variant="outline" render={<Link to="/sessions" />}>
            {t('sessions.session.back')}
          </Button>
        }
      />
      <SessionTerminal />
    </>
  );
}
