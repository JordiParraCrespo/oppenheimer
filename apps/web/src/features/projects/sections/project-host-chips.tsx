import { Chip, FieldDescription } from '@oppenheimer/design-system-web';
import { useSuspenseHosts } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';

/**
 * A chip per host, in `ProjectHostField`'s `QueryState.Data`; the picked one
 * again clears it. Reads only each host's id and name, so a refetch that
 * changes nothing else renders nothing. A refetch that fails keeps the chips
 * and says so beside them.
 */
export function ProjectHostChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (hostId: string | null) => void;
}) {
  const { t } = useTranslation();
  const { data: hosts, error } = useSuspenseHosts((rows) =>
    rows.map((host) => ({ id: host.id, name: host.name })),
  );

  return (
    <>
      <ErrorAlert error={error} fallback={t('sessions.new.host.failed')} className="w-full" />
      {hosts.length === 0 ? (
        <FieldDescription>{t('projects.dialog.noHost')}</FieldDescription>
      ) : (
        hosts.map((host) => (
          <Chip
            key={host.id}
            size="md"
            selected={value === host.id}
            onClick={() => onChange(value === host.id ? null : host.id)}
          >
            {host.name}
          </Chip>
        ))
      )}
    </>
  );
}
