import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { Terminal } from '@oppenheimer/design-system-web/icons';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageHead } from '@/components/page-head';

/**
 * The sessions list: the home screen of the product, and the sidebar of
 * `product/versions/mvp/05-screens.md` once sessions exist (name plus a
 * state dot from the runner's screen manifest). Until the sessions API lands
 * with the step-one spike it is the empty state that points at New session.
 */
export const Route = createFileRoute('/_authenticated/sessions/')({
  component: SessionsPage,
});

function SessionsPage() {
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
