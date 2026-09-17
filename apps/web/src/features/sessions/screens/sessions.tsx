import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { Terminal } from '@oppenheimer/design-system-web/icons';
import { PageHead } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * The sessions list: the home screen of the product, and the sidebar of
 * `product/versions/mvp/05-screens.md` once sessions exist (name plus a
 * state dot from the runner's screen manifest). `useSessions` in
 * `@oppenheimer/frontend-consumer` is where the list will come from; until the
 * sessions API lands with the step-one spike this is the empty state that
 * points at New session, and it does not ask for a list that cannot be served.
 */
export function SessionsScreen() {
  const { t } = useTranslation();

  return (
    <>
      <PageHead
        title={t('sessions.title')}
        sub={t('sessions.subtitle')}
        action={<Button render={<Link to="/sessions/new" />}>{t('sessions.newSession')}</Button>}
      />
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Terminal />
          </EmptyState.Media>
          <EmptyState.Title>{t('sessions.emptyTitle')}</EmptyState.Title>
          <EmptyState.Description>{t('sessions.emptyDescription')}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </>
  );
}
