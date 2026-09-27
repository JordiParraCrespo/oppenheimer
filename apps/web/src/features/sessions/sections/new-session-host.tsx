import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useSearch } from '@tanstack/react-router';
import { lazy, Suspense, useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { HostSelect } from '../components/host-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { toHostOptions } from '../lib/session-options';

/** The dialog loads when first opened: the composer is the console's first screen. */
const AddHostDialog = lazy(() =>
  import('../dialogs/add-host').then((module) => ({ default: module.AddHostDialog })),
);

/**
 * The host chip, bound to the draft. It reads the hosts because it draws them.
 * Add host… is this chip's dialog (the 2026-09-27 export): the machine it
 * pairs is picked here the moment Use this host is pressed. `?host=` still
 * names one in the address, for a link that arrives with a machine.
 */
export function NewSessionHost() {
  const { t } = useTranslation();
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  // Whether Add host… is open; the chip is the lowest component that reads it.
  const [adding, setAdding] = useState(false);
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'hostId' });

  const hosts = useHosts();
  useSearchPick(search.host, hosts.data, true, (host) => field.onChange(host.id));

  return (
    <>
      <HostSelect
        hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
        // A remembered host the workspace no longer has is shown as none once
        // the list answers, the way the project chip treats a project.
        value={hosts.data?.some((host) => host.id === field.value) ? field.value : null}
        onValueChange={field.onChange}
        onAddHost={() => setAdding(true)}
        loading={hosts.isPending}
        variant="tab"
      />
      <Suspense fallback={null}>
        {adding ? (
          <AddHostDialog
            onClose={() => setAdding(false)}
            onUseHost={(hostId) => {
              setAdding(false);
              field.onChange(hostId);
            }}
          />
        ) : null}
      </Suspense>
    </>
  );
}
