import { ChipSelect, type ChipSelectOption } from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The host chip of New session: which machine the work runs on.
 *
 * Props in, choice out — the list is read by the section above, which is the
 * only place on this screen that fetches. What this file owns is the
 * translation of a machine into a row: the name, the `hostname · os` line
 * underneath, and the word that says a host's runner is not dialled in.
 *
 * A list that has not arrived yet is `loading`, not `disabled`: a greyed-out
 * chip reads as a chip this workspace may not use, and the hosts are a second
 * away.
 *
 * An offline host stays selectable. The control plane records the session and
 * the work is owed to that machine the moment its runner connects, which is
 * what the `host_offline` hint on the create response means — so hiding it
 * would be hiding a session somebody can legitimately start.
 */
export function HostSelect({
  hosts,
  value,
  onValueChange,
  onAddHost,
  loading,
  disabled,
}: {
  hosts: ChipSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  onAddHost: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <ChipSelect
      value={value ?? ''}
      onValueChange={onValueChange}
      options={hosts}
      icon={<Cpu />}
      loading={loading}
      loadingText={t('sessions.new.host.loading')}
      disabled={disabled}
      aria-label={t('sessions.new.host.label')}
      placeholder={t('sessions.new.host.placeholder')}
      searchPlaceholder={t('sessions.new.host.search')}
      emptyText={t('sessions.new.host.empty')}
      action={{ label: t('sessions.new.host.add'), onSelect: onAddHost }}
    />
  );
}
