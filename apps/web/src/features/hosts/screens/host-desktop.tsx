import {
  EditorPageBack,
  PageHeader,
  PageHeaderMeta,
  PageHeaderRow,
} from '@oppenheimer/design-system-web';
import { Monitor } from '@oppenheimer/design-system-web/icons';
import { useHostDesktop, useHosts } from '@oppenheimer/frontend-consumer/react';
import { DesktopView } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Settings → Hosts → a host's Desktop (`product/research/device-streaming.md`,
 * "A host's desktop"): the machine's own screen, live, inside the Settings
 * frame. The same viewer as the session pane's Desktop tab; here it has the
 * page's measure, and Full screen the whole window. The name is read off the
 * host list the page above already holds; until it lands the crumb says Desktop.
 */
export function HostDesktopScreen({ hostId }: { hostId: string }) {
  const { t } = useTranslation();
  const back = { to: '/settings/hosts' as const };
  const connect = useHostDesktop(hostId);
  const { data: name } = useHosts({
    select: (hosts) => hosts.find((host) => host.id === hostId)?.name,
  });
  const label = name ?? t('hosts.desktop.label');

  return (
    <>
      <EditorPageBack render={<Link {...back} />}>{t('hosts.desktop.back')}</EditorPageBack>

      <PageHeader>
        <PageHeaderRow icon={<Monitor />} title={t('hosts.desktop.pageTitle')} />
        <PageHeaderMeta>
          <span>{t('hosts.desktop.pageLead', { name: label })}</span>
        </PageHeaderMeta>
      </PageHeader>

      <div className="flex aspect-video min-h-80 overflow-hidden rounded-lg border border-border-subtle">
        <DesktopView name={label} connect={connect} />
      </div>
    </>
  );
}
