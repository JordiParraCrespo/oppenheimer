import { Alert, AlertDescription, Badge, Button, Skeleton } from '@oppenheimer/design-system-web';
import { LogOut, Monitor, Smartphone } from '@oppenheimer/design-system-web/icons';
import type { UserSessionEntity } from '@oppenheimer/frontend-consumer';
import {
  useProfileSessions,
  useRevokeOtherProfileSessions,
  useRevokeProfileSession,
} from '@oppenheimer/frontend-consumer/react';
import {
  formatRelativeTime,
  RowControl,
  RowMedia,
  RowMeta,
  SectionCard,
  SectionHead,
  SectionRow,
  useErrorMessage,
} from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

export function SessionsSection() {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const sessions = useProfileSessions();
  const revokeOthers = useRevokeOtherProfileSessions();

  const hasOthers = (sessions.data ?? []).some((session) => !session.current);
  const failure = sessions.error ?? revokeOthers.error;

  return (
    <>
      <SectionHead title={t('profile.sessions.title')} sub={t('profile.sessions.description')} />

      {failure && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{resolveError(failure).message}</AlertDescription>
        </Alert>
      )}

      <SectionCard className="mb-[18px]">
        {sessions.isPending && (
          <div className="flex flex-col gap-3 p-[18px]">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
        )}
        {sessions.data?.length === 0 && (
          <p className="p-[18px] text-sm text-ink-400">{t('profile.sessions.empty')}</p>
        )}
        {sessions.data?.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </SectionCard>

      {/*
        Says what "Sign out" does not do. The list is devices only — the
        sessions minted for an API key or a connected app are filtered out
        server-side — so without this line the screen reads as the place where
        every kind of access is ended, and someone rotating a leaked key would
        stop here believing they had.
      */}
      <p className="mb-[18px] text-xs text-ink-400">{t('profile.sessions.credentialsNote')}</p>

      <Button
        variant="secondary"
        size="sm"
        disabled={!hasOthers || revokeOthers.isPending}
        onClick={() => revokeOthers.mutate()}
      >
        <LogOut data-icon="inline-start" />
        {t('profile.sessions.signOutAll')}
      </Button>
    </>
  );
}

/** One device; owns its own revoke so a pending row does not disable the rest. */
function SessionRow({ session }: { session: UserSessionEntity }) {
  const { t, i18n } = useTranslation();
  const revoke = useRevokeProfileSession();

  const DeviceIcon = session.deviceKind === 'mobile' ? Smartphone : Monitor;
  const lastSeen =
    formatRelativeTime(session.lastSeenAt, i18n.language) ?? t('profile.sessions.activeNow');

  return (
    <SectionRow className="py-3.5">
      <RowMedia>
        <DeviceIcon className="size-[17px] text-ink-600" />
      </RowMedia>
      <RowMeta
        name={session.deviceLabel ?? t('profile.sessions.unknownDevice')}
        description={`${session.ipAddress ?? t('profile.sessions.unknownLocation')} · ${lastSeen}`}
      />
      <RowControl>
        {session.current ? (
          <Badge variant="active">{t('profile.sessions.thisDevice')}</Badge>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(session.id)}
          >
            {t('profile.sessions.signOut')}
          </Button>
        )}
      </RowControl>
    </SectionRow>
  );
}
