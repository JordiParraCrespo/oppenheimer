import { FilterChip } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { FilterChipEntry } from '../lib/session-filters';

/**
 * What the filter menu is currently hiding, stated under the header
 * (`.op-filterchips`: 4px apart, in the sidebar's 12px gutter, 8px of air
 * before the list). Without it a narrowed list and an empty one look the
 * same. Each chip clears its own facet, or its own repository of the set.
 */
export function SessionFilterChips({
  chips,
  onClear,
}: {
  chips: FilterChipEntry[];
  onClear: (chip: FilterChipEntry) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1 px-3 pb-2">
      {chips.map((chip) => (
        <FilterChip
          key={`${chip.key}:${chip.value}`}
          removeLabel={t('sessions.filters.remove')}
          onRemove={() => onClear(chip)}
        >
          {chip.label}
        </FilterChip>
      ))}
    </div>
  );
}
