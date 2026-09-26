import { useSessions } from '@oppenheimer/frontend-consumer/react';
import { useTranslation } from 'react-i18next';
import { HostSessions } from '../sections/host-sessions';

/**
 * The hosts page: what each machine is running right now.
 *
 * The screen owns the page's frame, the heading and the column, and mounts
 * the one pane below it.
 */
export function HostsScreen({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const { data: sessions } = useSessions();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <h1 className="text-lg text-fg">{t('nav.sessions')}</h1>
      <HostSessions hostId={hostId} sessions={sessions ?? []} />
    </main>
  );
}
