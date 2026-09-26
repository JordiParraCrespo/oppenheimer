import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { HostSelect } from '../components/host-select';
import { AddHostDialog } from '../dialogs/add-host';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { toHostOptions } from '../lib/session-options';

/**
 * The host chip, bound to the draft. It reads the hosts because it draws them,
 * and Add host is its dialog: the host a reader connects there is the one the
 * chip then holds.
 */
export function NewSessionHost() {
  const { t } = useTranslation();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'hostId' });
  const [adding, setAdding] = useState(false);

  const hosts = useHosts();

  return (
    <>
      <HostSelect
        hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
        value={field.value}
        onValueChange={field.onChange}
        onAddHost={() => setAdding(true)}
        loading={hosts.isPending}
        variant="tab"
      />

      {adding ? (
        <AddHostDialog
          onClose={() => setAdding(false)}
          onUseHost={(hostId) => {
            field.onChange(hostId);
            setAdding(false);
          }}
        />
      ) : null}
    </>
  );
}
