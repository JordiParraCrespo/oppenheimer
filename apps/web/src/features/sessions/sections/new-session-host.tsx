import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { lazy, Suspense, useState } from 'react';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { HostSelect } from '../components/host-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { toHostOptions } from '../lib/session-options';

/**
 * The dialog loads when first opened: New session is the console's landing
 * screen, and pairing a machine is the rare path through it.
 */
const AddHostDialog = lazy(() =>
  import('../dialogs/add-host').then((module) => ({ default: module.AddHostDialog })),
);

/**
 * The host chip, bound to the draft. It reads the hosts because it draws them.
 * Add host… opens the Add a host dialog over the console, and the machine it
 * pairs comes straight back to this chip, picked for the next session. The
 * dialog's open state is the chip's: nothing else on the screen reads it.
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
              field.onChange(hostId);
              setAdding(false);
            }}
          />
        ) : null}
      </Suspense>
    </>
  );
}
