import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
} from '@oppenheimer/design-system-web';
import { LogOut } from '@oppenheimer/design-system-web/icons';
import {
  useProfile,
  useProfileSessions,
  useRevokeOtherProfileSessions,
  useRevokeProfileSession,
} from '@oppenheimer/frontend/react';
import { useTranslation } from 'react-i18next';
import {
  GroupHeading,
  RowControl,
  RowMeta,
  SectionCard,
  SectionHead,
  SectionRow,
} from '@/components/section-ui';
import { dateFormatter } from '@/lib/format-date';
import { useErrorMessage } from '@/lib/use-error-message';
import { useLocale } from '@/lib/use-locale';

/**
 * The reader's own security: every device signed in to their account, with a
 * way to end any of them. Workspace-wide policy (password floors, session
 * lengths, approved domains) is not a thing this deployment stores yet, so the
 * pane says nothing about it rather than showing controls that do nothing.
 */
export function SecuritySection() {
  const { t } = useTranslation();

  return (
    <>
      <SectionHead title={t('settings.security.title')} sub={t('settings.security.description')} />
      <SessionsCard />
    </>
  );
}

/**
 * The reader's own live sign-ins.
 *
 * `/v1/profile/sessions` scopes the list to the caller, so this is every device
 * *you* are signed in on — not the whole workspace's. Presenting one as the
 * other would imply an admin can end a colleague's session from here, which
 * this card cannot do.
 *
 * The same hooks back the profile screen's Sessions pane; there is one way to
 * read and revoke a session, not one per screen.
 */
function SessionsCard() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const sessions = useProfileSessions();
  const profile = useProfile();
  const revoke = useRevokeProfileSession();
  const revokeOthers = useRevokeOtherProfileSessions();

  const locale = useLocale();
  const dateTime = dateFormatter(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const name = profile.data ? `${profile.data.firstName} ${profile.data.lastName}`.trim() : '';
  const others = sessions.data?.filter((session) => !session.current) ?? [];

  return (
    <>
      <GroupHeading
        action={
          <Button
            variant="ghost"
            size="sm"
            disabled={revokeOthers.isPending || others.length === 0}
            onClick={() => revokeOthers.mutate()}
          >
            <LogOut data-icon="inline-start" />
            {t('settings.security.signOutOthers')}
          </Button>
        }
      >
        {t('settings.security.sessions')}
      </GroupHeading>

      {(sessions.error || revoke.error || revokeOthers.error) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            {resolveError(sessions.error ?? revoke.error ?? revokeOthers.error).message}
          </AlertDescription>
        </Alert>
      )}

      <SectionCard className="mb-3">
        {sessions.isLoading && (
          <SectionRow>
            <span className="text-sm text-ink-600">{t('common.loading')}</span>
          </SectionRow>
        )}

        {sessions.data?.map((session) => (
          <SectionRow key={session.id}>
            <Avatar size={32}>
              <AvatarFallback gradient="purple">
                {name.charAt(0).toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <RowMeta
              name={name || (profile.data?.email ?? '')}
              description={`${session.deviceLabel ?? t('settings.security.unknownDevice')} · ${
                session.ipAddress ?? '—'
              }`}
            />
            <RowControl>
              <span className="text-xs whitespace-nowrap text-ink-400">
                {dateTime.format(session.createdAt)}
              </span>
              {session.current ? (
                <Badge variant="active">{t('settings.security.thisDevice')}</Badge>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(session.id)}
                >
                  {t('settings.security.signOut')}
                </Button>
              )}
            </RowControl>
          </SectionRow>
        ))}
      </SectionCard>

      {/* Devices only — an API key or connected app is revoked on its own card. */}
      <p className="mb-8 text-xs text-ink-400">{t('settings.security.sessionsNote')}</p>
    </>
  );
}
