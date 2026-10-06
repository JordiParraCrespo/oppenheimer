import { Button, EmptyState } from '@oppenheimer/design-system-web';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { getRouteApi, Link, Navigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useGoogleReturn } from '../hooks/use-google-return';

const route = getRouteApi('/_authenticated/plan/calendar_/google');

/**
 * Where Google sends the browser back after consent (`/plan/calendar/google`).
 * It posts the code once and goes on to the calendar; a refusal at Google, or
 * a code the API would not take, stays here and says so.
 */
export function GoogleCalendarReturnScreen() {
  const { t } = useTranslation();
  const search = route.useSearch();
  const connect = useGoogleReturn(search);
  if (connect.isSuccess) return <Navigate to="/plan/calendar" replace />;
  const refused = Boolean(search.error) || !search.code || !search.state;

  return (
    <>
      {refused || connect.isError ? (
        <>
          {refused ? (
            <ErrorAlert message={t('calendar.google.refused')} />
          ) : (
            <ErrorAlert error={connect.error} fallback={t('calendar.google.connectFailed')} />
          )}
          <Button variant="secondary" render={<Link to="/plan/calendar" />}>
            {t('calendar.google.back')}
          </Button>
        </>
      ) : (
        <EmptyState>
          <EmptyState.Header>
            <EmptyState.Title>{t('calendar.google.connecting')}</EmptyState.Title>
          </EmptyState.Header>
        </EmptyState>
      )}
    </>
  );
}
