import { Button } from '@oppenheimer/design-system-web';
import { RouteNotFound } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RootFallback } from '../components/root-fallback';

/** A URL outside every layout. The way back is `/`, which knows whether that means the console or sign-in. */
export function RootNotFoundScreen() {
  const { t } = useTranslation();

  return (
    <RootFallback>
      <RouteNotFound>
        <Button variant="secondary" render={<Link to="/" />}>
          {t('errors.notFound.home')}
        </Button>
      </RouteNotFound>
    </RootFallback>
  );
}
