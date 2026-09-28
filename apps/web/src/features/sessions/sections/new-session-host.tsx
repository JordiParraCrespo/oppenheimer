import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useConsoleDialog } from '@oppenheimer/frontend-web';
import { useSearch } from '@tanstack/react-router';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { HostSelect } from '../components/host-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { toHostOptions } from '../lib/session-options';

/**
 * The host chip, bound to the draft. It reads the hosts because it draws them.
 * Add host… asks the console for its Add a host dialog; the machine it pairs
 * is picked here the moment Use this host is pressed. `?host=` still names
 * one in the address, for a link that arrives with a machine.
 */
export function NewSessionHost() {
  const { t } = useTranslation();
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const dialogs = useConsoleDialog();
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'hostId' });

  const resolveError = useErrorMessage();
  const hosts = useHosts();
  useSearchPick(search.host, hosts.data, true, (host) => field.onChange(host.id));

  return (
    <HostSelect
      hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
      // A remembered host the workspace no longer has is shown as none once
      // the list answers, the way the project chip treats a project.
      value={hosts.data?.some((host) => host.id === field.value) ? field.value : null}
      onValueChange={field.onChange}
      onAddHost={() => dialogs.open({ kind: 'add-host', onUseHost: field.onChange })}
      loading={hosts.isPending}
      failure={
        hosts.isError ? resolveError(hosts.error, t('sessions.new.host.failed')).message : undefined
      }
      variant="tab"
    />
  );
}
