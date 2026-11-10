import { useHostDesktop, useHosts } from '@oppenheimer/frontend-consumer/react';
import { DesktopView } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * The preview pane's Desktop: the session's host's own screen, the one its
 * agent works on, through the screen-sharing server the host's owner shared
 * (`product/research/device-streaming.md`, "A host's desktop"). The same
 * viewer as the host's Desktop in Settings; Full screen gives it the room the
 * pane does not. Its socket is open while this tab is shown.
 */
export function SessionDesktop({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const connect = useHostDesktop(hostId);
  const { data: name } = useHosts({
    select: (hosts) => hosts.find((host) => host.id === hostId)?.name,
  });

  return <DesktopView name={name ?? t('hosts.desktop.label')} connect={connect} />;
}
