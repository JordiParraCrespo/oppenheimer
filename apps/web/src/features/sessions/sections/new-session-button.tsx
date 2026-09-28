import { Button } from '@oppenheimer/design-system-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The sidebar's New session button. It is the view's one primary action only
 * while a session is open; on New session itself the composer's send is, so
 * the button steps back to secondary there (the frame's `newBtnVariant`).
 * Its own section, so a navigation redraws this button and not the list.
 */
export function NewSessionButton() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const here = pathname === '/sessions/new';
  const sessionOpen = !here && pathname.startsWith('/sessions/');
  return (
    <Button
      size="sm"
      block
      variant={sessionOpen ? 'primary' : 'secondary'}
      aria-current={here ? 'page' : undefined}
      render={<Link to="/sessions/new" />}
    >
      {t('nav.newSession')}
    </Button>
  );
}
