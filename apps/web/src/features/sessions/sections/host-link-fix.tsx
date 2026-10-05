import { CommandRow, CommandRowList, Link } from '@oppenheimer/design-system-web';
import { Link as RouterLink } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * What brings a host's runner back when it does not come back by itself: the
 * commands to run on that machine, each a line to copy, and the way to
 * Settings → Hosts. It sits in the drawer `HostLinkChrome` opens from How to
 * fix, so it is drawn on the terminal's surface.
 */
export function HostLinkFix({ host }: { host: string }) {
  const { t } = useTranslation();
  const copy = {
    copyLabel: t('sessions.session.hostLink.copy'),
    copiedLabel: t('sessions.session.hostLink.copied'),
  };
  return (
    <>
      <CommandRowList>
        {
          // oppenheimer:begin runner
          <>
            <CommandRow
              surface="terminal"
              lead={t('sessions.session.hostLink.install', { host })}
              command="oppenheimer-runner install"
              {...copy}
            />
            <CommandRow
              surface="terminal"
              lead={t('sessions.session.hostLink.statusCommand')}
              command="oppenheimer-runner status"
              {...copy}
            />
          </>
          // oppenheimer:end runner
        }
      </CommandRowList>
      <div className="mt-1 text-[13px]">
        <Link render={<RouterLink to="/settings/hosts" />}>
          {t('sessions.session.hostLink.hosts')}
        </Link>
      </div>
    </>
  );
}
