import { EmptyState } from '@oppenheimer/design-system-web';
import { Plus } from '@oppenheimer/design-system-web/icons';
import { PageHead } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * New session: the four chips of `product/versions/mvp/00-scope.md` (host,
 * repo, branch, agent) and a Start button. The form arrives with the
 * sessions API (`useCreateSession` and `useHosts` in
 * `@oppenheimer/frontend-consumer` already take its input); the screen exists
 * now so the nav, the command palette and the onboarding flow point at the
 * real destination.
 */
export function NewSessionScreen() {
  const { t } = useTranslation();

  return (
    <>
      <PageHead title={t('sessions.new.title')} sub={t('sessions.new.subtitle')} />
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Plus />
          </EmptyState.Media>
          <EmptyState.Title>{t('sessions.new.emptyTitle')}</EmptyState.Title>
          <EmptyState.Description>{t('sessions.new.emptyDescription')}</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </>
  );
}
