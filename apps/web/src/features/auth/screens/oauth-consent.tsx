import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import { usePermissionCatalog } from '@oppenheimer/frontend-consumer/react';
import { useProfile } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConsentSearch, describeScopes, submitConsent } from '@/features/auth/lib/consent';
import { CenteredCard } from '../components/centered-card';
import { ConsentScopesSkeleton } from '../components/consent-scopes-skeleton';

/** Where the email goes in the description while the profile loads. */
const EMAIL_SLOT = '\u0000';

/**
 * Better Auth's MCP plugin sends the user here mid-authorization with the
 * client and the scopes it asked for; approving posts the consent code back and
 * follows the redirect it returns.
 */
export function OAuthConsentScreen({ search }: { search: ConsentSearch }) {
  const { t } = useTranslation();
  const { data: user } = useProfile();

  const [pending, setPending] = useState<'accept' | 'deny' | null>(null);
  const [error, setError] = useState<unknown>(null);

  // The catalog comes from the API rather than the shared package: it is the
  // deployment's own answer, and it keeps this screen correct if the two drift.
  const catalog = usePermissionCatalog();
  const { scopes, unknown } = describeScopes(search.scope, catalog.data?.groups ?? []);
  // How many scopes the client asked for is in the URL, so the placeholder
  // draws that many rows and a request for none needs no catalog at all.
  const requested = describeScopes(search.scope, []).unknown.length;
  const described = requested === 0 || catalog.data !== undefined;
  const [beforeEmail, afterEmail] = t('consent.description', { email: EMAIL_SLOT }).split(
    EMAIL_SLOT,
  );

  function respond(accept: boolean) {
    if (!search.consent_code) return;
    setPending(accept ? 'accept' : 'deny');
    setError(null);

    submitConsent(accept, search.consent_code).then(
      (redirectURI) => {
        window.location.href = redirectURI;
      },
      (cause: unknown) => {
        setError(cause);
        setPending(null);
      },
    );
  }

  if (!search.consent_code) {
    return (
      <CenteredCard title={t('consent.invalidTitle')} description={t('consent.invalidDescription')}>
        <Button render={<Link to="/sessions/new" />}>{t('consent.backToSessions')}</Button>
      </CenteredCard>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {t('consent.title', {
              client: search.client_id ?? t('consent.unknownClient'),
            })}
          </CardTitle>
          <CardDescription>
            {user ? (
              t('consent.description', { email: user.email })
            ) : (
              <>
                {beforeEmail}
                <span className="inline-flex h-4.5 items-center align-bottom">
                  <Skeleton shape="sm" className="h-3 w-36" />
                </span>
                {afterEmail}
              </>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-4">
            <ErrorAlert error={error} fallback={t('consent.failed')} />

            {!described && catalog.isPending && <ConsentScopesSkeleton count={requested} />}
            {!described && catalog.isError && (
              <ErrorAlert error={catalog.error} fallback={t('consent.catalogFailed')} />
            )}
            {described && (
              <>
                <div className="divide-y rounded-md border">
                  {scopes.length === 0 && (
                    <p className="p-4 text-sm text-ink-600">{t('consent.noPermissions')}</p>
                  )}
                  {scopes.map(({ group, level }) => (
                    <div key={`${group.resource}:${level}`} className="flex items-start gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{group.label}</span>
                          <Badge variant="neutral">{group.levels[level].label}</Badge>
                          {group.sensitive && (
                            <Badge variant="paused">{t('consent.sensitiveScope')}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-ink-600">{group.levels[level].description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {unknown.length > 0 && (
                  <p className="text-sm text-ink-600">
                    {t('consent.unknownScopes', { scopes: unknown.join(', ') })}
                  </p>
                )}
              </>
            )}

            <p className="text-sm text-ink-600">{t('consent.effectiveNote')}</p>
          </div>
        </CardContent>

        <CardFooter className="justify-end">
          <Button
            variant="outline"
            disabled={pending === 'accept'}
            onClick={() => respond(false)}
            pending={pending === 'deny'}
            pendingLabel={t('common.loading')}
          >
            {t('consent.deny')}
          </Button>
          <Button
            disabled={pending === 'deny' || !described}
            onClick={() => respond(true)}
            pending={pending === 'accept'}
            pendingLabel={t('common.loading')}
          >
            {t('consent.approve')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
