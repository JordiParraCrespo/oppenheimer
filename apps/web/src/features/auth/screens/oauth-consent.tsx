import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@oppenheimer/design-system-web';
import { usePermissionCatalog } from '@oppenheimer/frontend-consumer/react';
import { useProfile } from '@oppenheimer/frontend-core/react';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type ConsentSearch, describeScopes, readError } from '@/features/auth/lib/consent';

/**
 * OAuth consent screen.
 *
 * Better Auth's MCP plugin sends the user here mid-authorization with the
 * client and the scopes it asked for; approving posts the consent code back and
 * follows the redirect it returns. Signing in first is required, so an
 * unauthenticated visitor is bounced to the login page and returned here.
 */
export function OAuthConsentScreen({ search }: { search: ConsentSearch }) {
  const { t } = useTranslation();
  const { data: user } = useProfile();

  const [pending, setPending] = useState<'accept' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The catalog comes from the API rather than the shared package: it is the
  // deployment's own answer, and it keeps this screen correct if the two drift.
  const catalog = usePermissionCatalog();
  const { scopes, unknown } = describeScopes(search.scope, catalog.data?.groups ?? []);

  async function respond(accept: boolean) {
    setPending(accept ? 'accept' : 'deny');
    setError(null);

    try {
      const response = await fetch('/api/auth/oauth2/consent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accept, consent_code: search.consent_code }),
      });

      if (!response.ok) throw new Error(await readError(response));

      const { redirectURI } = (await response.json()) as {
        redirectURI?: string;
      };
      if (!redirectURI) throw new Error(t('consent.noRedirect'));

      // Hand control back to the OAuth client.
      window.location.href = redirectURI;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setPending(null);
    }
  }

  if (!search.consent_code) {
    return (
      <CenteredCard title={t('consent.invalidTitle')} description={t('consent.invalidDescription')}>
        <Button render={<Link to="/sessions" />}>{t('consent.backToSessions')}</Button>
      </CenteredCard>
    );
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-2xl items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>
            {t('consent.title', {
              client: search.client_id ?? 'An application',
            })}
          </CardTitle>
          <CardDescription>
            {t('consent.description', { email: user?.email ?? '' })}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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

          <p className="text-sm text-ink-600">{t('consent.effectiveNote')}</p>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" disabled={pending !== null} onClick={() => respond(false)}>
            {pending === 'deny' ? t('common.loading') : t('consent.deny')}
          </Button>
          <Button disabled={pending !== null} onClick={() => respond(true)}>
            {pending === 'accept' ? t('common.loading') : t('consent.approve')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function CenteredCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-md items-center p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardFooter>{children}</CardFooter>
      </Card>
    </div>
  );
}
