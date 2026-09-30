import {
  ChipSelect,
  type ChipSelectOption,
  type ChipSelectTriggerVariant,
} from '@oppenheimer/design-system-web';
import { Cpu } from '@oppenheimer/design-system-web/icons';
import { useTranslation } from 'react-i18next';

/**
 * The host chip of New session. Props in, choice out: the section above does
 * the fetching. A list that has not arrived is `loading`, not `disabled`: a
 * greyed chip reads as one this workspace may not use.
 */
export function HostSelect({
  hosts,
  value,
  onValueChange,
  onAddHost,
  loading,
  failure,
  disabled,
  variant,
}: {
  hosts: ChipSelectOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  onAddHost: () => void;
  loading?: boolean;
  failure?: string;
  disabled?: boolean;
  variant?: ChipSelectTriggerVariant;
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
      variant={variant}
      aria-label={t('sessions.new.host.label')}
      placeholder={t('sessions.new.host.placeholder')}
      searchPlaceholder={t('sessions.new.host.search')}
      emptyText={failure ?? t('sessions.new.host.empty')}
      action={{ label: t('sessions.new.host.add'), onSelect: onAddHost }}
    />
  );
}
