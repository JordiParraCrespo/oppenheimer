import { HostCard } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useRenameHost } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { notifySuccess, RelativeTime } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HostActionsMenu } from '../components/host-actions-menu';
import { RemoveHostDialog } from '../dialogs/remove-host';
import { SessionLimitDialog } from '../dialogs/session-limit';
import { RenameHostForm } from '../forms/rename-host';
import { cardStatusOf, type MetaPart, metaPartsOf } from '../lib/host-card';

/**
 * One host on Settings (`design/version1/Settings.dc.html`): its dot, name
 * and meta line, its state and when it was last seen, and the ellipsis.
 *
 * The row owns what its menu opens — the inline rename, the session limit and
 * the remove dialog — because the menu's content unmounts when it closes, and
 * nothing above a row reads any of them.
 */
export function HostRow({ host }: { host: HostEntity }) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [limiting, setLimiting] = useState(false);
  const resolveError = useErrorMessage();
  const rename = useRenameHost({
    onSuccess: (renamed) => {
      setRenaming(false);
      notifySuccess('hostRenamed', { name: renamed.name });
    },
  });

  const wordOf = (part: MetaPart) => {
    switch (part.kind) {
      case 'cpus':
        return t('hosts.settings.meta.cpus', { count: part.count });
      case 'runner':
        return t('hosts.settings.meta.runner', { version: part.version });
      default:
        return part.value;
    }
  };
  const status = cardStatusOf(host);

  return (
    <>
      <HostCard
        data-testid="host-card"
        status={status}
        name={host.name}
        rename={
          renaming ? (
            <RenameHostForm
              defaultName={host.name}
              pending={rename.isPending}
              error={
                rename.error
                  ? resolveError(rename.error, t('hosts.settings.renameFailed')).message
                  : undefined
              }
              onSubmit={(name) => rename.mutate({ id: host.id, name })}
              onCancel={() => {
                rename.reset();
                setRenaming(false);
              }}
            />
          ) : undefined
        }
        meta={metaPartsOf(host).map(wordOf).join(' · ') || undefined}
        state={
          status === 'running'
            ? host.details.sessionLimit !== null
              ? t('hosts.settings.state.runningOfLimit', {
                  count: host.details.runningSessionCount,
                  limit: host.details.sessionLimit,
                })
              : t('hosts.settings.state.running', { count: host.details.runningSessionCount })
            : t(`hosts.settings.state.${status}`)
        }
        // The frame's words: "connected" while the link is up, "last seen 2
        // days ago" once it is not, nothing for a host that never connected.
        // The minute tick lives in RelativeTime and redraws only this line.
        seen={
          host.online ? (
            t('hosts.settings.seen.connected')
          ) : host.lastSeenAt ? (
            <RelativeTime date={host.lastSeenAt}>
              {(when) =>
                t('hosts.settings.seen.lastSeen', { when: when ?? t('hosts.settings.seen.now') })
              }
            </RelativeTime>
          ) : null
        }
        action={
          <HostActionsMenu
            name={host.name}
            onRename={() => setRenaming(true)}
            onLimit={() => setLimiting(true)}
            onRemove={() => setRemoving(true)}
          />
        }
      />
      {limiting ? <SessionLimitDialog host={host} onClose={() => setLimiting(false)} /> : null}
      {removing ? <RemoveHostDialog host={host} onClose={() => setRemoving(false)} /> : null}
    </>
  );
}
