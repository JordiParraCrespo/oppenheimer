import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useSearch } from '@tanstack/react-router';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { PlaceSelect } from '../components/place-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { toHostOptions } from '../lib/session-options';

/**
 * The place chip, bound to the draft: the host and where on it, a new
 * worktree or a folder already there. It reads the hosts because it draws
 * them. Add host… asks the console for its Add a host dialog; the machine it
 * pairs is picked here the moment Use this host is pressed. `?host=` still
 * names one in the address, for a link that arrives with a machine.
 */
export function NewSessionPlace() {
  const { t } = useTranslation();
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const dialogs = useConsoleDialog();
  const { control } = useNewSessionDraft();
  const { field: host } = useController({ control, name: 'hostId' });
  const { field: where } = useController({ control, name: 'where' });

  const resolveError = useErrorMessage();
  const hosts = useHosts();
  useSearchPick(search.host, hosts.data, true, (picked) => host.onChange(picked.id));

  return (
    <PlaceSelect
      hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
      // A remembered host the workspace no longer has is shown as none once
      // the list answers, the way the project chip treats a project.
      hostId={hosts.data?.some((candidate) => candidate.id === host.value) ? host.value : null}
      place={where.value}
      onHostChange={host.onChange}
      onPlaceChange={where.onChange}
      onAddHost={() => dialogs.open({ kind: 'add-host', onUseHost: host.onChange })}
      loading={hosts.isPending}
      failure={
        hosts.isError ? resolveError(hosts.error, t('sessions.new.host.failed')).message : undefined
      }
    />
  );
}
