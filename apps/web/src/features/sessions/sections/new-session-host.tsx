import { useHosts } from '@oppenheimer/frontend-consumer/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { HostSelect } from '../components/host-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import { toHostOptions } from '../lib/session-options';

/**
 * The host chip, bound to the draft. It reads the hosts because it draws them.
 * Add host… is the Add a host page (`/hosts/new`), which lands back here with
 * the machine it paired in the address (`?host=`), and the chip picks it once
 * the list holds it.
 */
export function NewSessionHost() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const { control } = useNewSessionDraft();
  const { field } = useController({ control, name: 'hostId' });

  const hosts = useHosts();
  useSearchPick(search.host, hosts.data, true, (host) => field.onChange(host.id));

  return (
    <HostSelect
      hosts={toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') })}
      // A remembered host the workspace no longer has is shown as none once
      // the list answers, the way the project chip treats a project.
      value={hosts.data?.some((host) => host.id === field.value) ? field.value : null}
      onValueChange={field.onChange}
      onAddHost={() => navigate({ to: '/hosts/new' })}
      loading={hosts.isPending}
      variant="tab"
    />
  );
}
