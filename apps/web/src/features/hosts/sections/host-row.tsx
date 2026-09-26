import { HostCard, toast } from '@oppenheimer/design-system-web';
import type { HostEntity } from '@oppenheimer/frontend-consumer';
import { useRenameHost } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HostActionsMenu } from '../components/host-actions-menu';
import { HostSeen } from '../components/host-seen';
import { RemoveHostDialog } from '../dialogs/remove-host';
import { RenameHostForm } from '../forms/rename-host';
import { cardStatusOf, type MetaPart, metaPartsOf } from '../lib/host-card';

/**
 * One host on Settings (`design/version1/Settings.dc.html`): its dot, name
 * and meta line, its state and when it was last seen, and the ellipsis.
 *
 * The row owns what its menu opens — the inline rename and the remove dialog —
 * because the menu's content unmounts when it closes, and nothing above a row
 * reads either.
 */
export function HostRow({ host }: { host: HostEntity }) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const rename = useRenameHost({
    onSuccess: () => {
      setRenaming(false);
      toast.success(t('hosts.settings.renamed'));
    },
  });

  const wordOf = (part: MetaPart) => {
    switch (part.kind) {
      case 'cpus':
        return t('hosts.settings.meta.cpus', { count: part.count });
      case 'memory':
        return t('hosts.settings.meta.memory', { gb: part.gb });
      case 'runner':
        return t('hosts.settings.meta.runner', { version: part.version });
      default:
        return part.value;
    }
  };
  const { status, runningSessionCount } = host.details;

  return (
    <>
      <HostCard
        data-testid="host-card"
        status={cardStatusOf(host)}
        name={
          renaming ? (
            <RenameHostForm
              defaultName={host.name}
              pending={rename.isPending}
              onSubmit={(name) => rename.mutate({ id: host.id, name })}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            host.name
          )
        }
        meta={metaPartsOf(host).map(wordOf).join(' · ') || undefined}
        state={
          status === 'running'
            ? t('hosts.settings.state.running', { count: runningSessionCount })
            : t(`hosts.settings.state.${status}`)
        }
        seen={
          <HostSeen
            online={host.online}
            lastSeenAt={host.lastSeenAt}
            roundTripMillis={host.details.roundTripMillis}
          />
        }
        action={
          renaming ? undefined : (
            <HostActionsMenu
              name={host.name}
              id={host.id}
              onRename={() => setRenaming(true)}
              onCopyId={() => {
                void navigator.clipboard?.writeText(host.id);
                toast.success(t('hosts.settings.copied'));
              }}
              onRemove={() => setRemoving(true)}
            />
          )
        }
      />
      {removing ? <RemoveHostDialog host={host} onClose={() => setRemoving(false)} /> : null}
    </>
  );
}
