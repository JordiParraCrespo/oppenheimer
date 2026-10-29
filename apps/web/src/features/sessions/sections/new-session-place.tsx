import { useCloudAgentStatus, useHosts } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useController } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useConsoleDialog } from '@/lib/console';
import { PlaceSelect } from '../components/place-select';
import { useNewSessionDraft } from '../hooks/use-new-session-form';
import { useSearchPick } from '../hooks/use-search-pick';
import {
  claudeCloudHost,
  engineForPlace,
  toCloudOptions,
  toHostOptions,
  toStartFromOptions,
} from '../lib/session-options';

/**
 * The place chip, bound to the draft: a host and where on it — a new
 * worktree, a folder already there, or Claude Code's cloud started from it —
 * or a vendor's cloud the console launches the session at (`cloudProvider`). The Claude
 * Code row under Cloud picks a host that can start it (`claudeCloudHost`). It reads the hosts and
 * whether the reader can run in the cloud, because it draws both. Add host…
 * asks the console for its Add a host dialog; the machine it pairs is picked
 * here the moment Use this host is pressed. A vendor with no key yet goes to
 * Settings → Cloud agents. `?host=` still names one in the address, for a
 * link that arrives with a machine.
 *
 * A place is picked with the engine it takes (`engineForPlace`): Claude
 * Code's cloud brings Claude Code, the only agent it runs. The Start from
 * pane's rows are judged here from the hosts (`toStartFromOptions`).
 *
 * A cloud pick runs the vendor's own agent, so it is the agent chip's too
 * (`NewSessionAgent`): the draft keeps the host, folder and host agent as they
 * were, and a host place picked from the cloud puts them back.
 */
export function NewSessionPlace() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ from: '/_authenticated/sessions/new' });
  const dialogs = useConsoleDialog();
  const { control, getValues, setValue } = useNewSessionDraft();
  const { field: host } = useController({ control, name: 'hostId' });
  const { field: where } = useController({ control, name: 'where' });
  const { field: cloudProvider } = useController({ control, name: 'cloudProvider' });

  const resolveError = useErrorMessage();
  const hosts = useHosts();
  const status = useCloudAgentStatus();
  useSearchPick(search.host, hosts.data, true, (picked) => host.onChange(picked.id));
  const hostOptions = toHostOptions(hosts.data ?? [], { offline: t('sessions.new.host.offline') });
  const claudeHost = claudeCloudHost(hosts.data ?? [], host.value);

  return (
    <PlaceSelect
      hosts={hostOptions}
      // A remembered host the workspace no longer has is shown as none once
      // the list answers, the way the project chip treats a project.
      hostId={hosts.data?.some((candidate) => candidate.id === host.value) ? host.value : null}
      place={where.value}
      claudeCloud={hostOptions.find((option) => option.value === claudeHost?.id) ?? null}
      startFrom={toStartFromOptions(hosts.data ?? [], {
        offline: t('sessions.new.host.offline'),
        cannot: t('sessions.new.where.claudeCloud.cannot'),
      })}
      clouds={toCloudOptions(status.data, { connect: t('sessions.new.where.connect') })}
      cloud={cloudProvider.value}
      onHostChange={host.onChange}
      onPlaceChange={(place) => {
        // Only when leaving a vendor: a write wakes every chip that watches it.
        if (cloudProvider.value !== null) cloudProvider.onChange(null);
        const [agent, model] = getValues(['agent', 'model']);
        const engine = engineForPlace({ where: place, cloudProvider: null }, { agent, model });
        if (engine.agent !== agent) {
          setValue('agent', engine.agent);
          setValue('model', engine.model);
        }
        where.onChange(place);
      }}
      onCloudChange={(provider) => {
        cloudProvider.onChange(provider);
        where.onChange('cloud');
      }}
      onConnectCloud={() => navigate({ to: '/settings/cloud-agents' })}
      onAddHost={() => dialogs.open({ kind: 'add-host', onUseHost: host.onChange })}
      loading={hosts.isPending}
      failure={
        hosts.isError ? resolveError(hosts.error, t('sessions.new.host.failed')).message : undefined
      }
    />
  );
}
