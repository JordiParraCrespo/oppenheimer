import { Button } from '@oppenheimer/design-system-web';
import { RouteNotFound } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * A URL the console does not have, answered inside the console.
 *
 * It is mounted twice: as the `_authenticated` layout's `notFoundComponent`,
 * for a `notFound()` thrown under it, and as the catch-all route, for a path
 * that matched nothing at all. Both keep the sidebar — the reader is still in
 * the product, with their sessions and New session one click away, instead of
 * on a bare page that has lost the app.
 */
export function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <RouteNotFound>
      <Button variant="secondary" render={<Link to="/sessions/new" />}>
        {t('nav.newSession')}
      </Button>
    </RouteNotFound>
  );
}
