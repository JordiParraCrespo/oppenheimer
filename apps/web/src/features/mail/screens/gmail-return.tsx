import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { getRouteApi, Link, Navigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useGmailReturn } from '@/features/mail/hooks/use-gmail-return';

const route = getRouteApi('/_authenticated/settings/mail_/google');

/**
 * Where Google sends the browser back after consent (`/settings/mail/google`).
 * It posts the code once and goes on to Settings → Mail, where the account is
 * now listed; a refusal at Google, or a code the API would not take, stays
 * here and says so.
 */
export function GmailReturnScreen() {
  const { t } = useTranslation();
  const search = route.useSearch();
  const connect = useGmailReturn(search);
  if (connect.isSuccess) return <Navigate to="/settings/mail" replace />;
  const refused = Boolean(search.error) || !search.code || !search.state;

  return refused || connect.isError ? (
    <div className="flex flex-col items-start gap-4">
      {refused ? (
        <ErrorAlert message={t('settings.mail.refused')} />
      ) : (
        <ErrorAlert error={connect.error} fallback={t('settings.mail.connectFailed')} />
      )}
      <Button variant="secondary" render={<Link to="/settings/mail" />}>
        {t('settings.mail.back')}
      </Button>
    </div>
  ) : (
    <EmptyState>
      <EmptyState.Header>
        <EmptyState.Title>{t('settings.mail.connecting')}</EmptyState.Title>
      </EmptyState.Header>
    </EmptyState>
  );
}
