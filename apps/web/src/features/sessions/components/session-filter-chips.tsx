import { FilterChip } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import type { SessionFacet } from '../lib/session-filters';

/**
 * What the filter menu is currently hiding, stated under the header
 * (`.op-filterchips`: 4px apart, in the sidebar's 12px gutter, 8px of air
 * before the list). Without it a narrowed list and an empty one look the
 * same. Each chip clears its own facet.
 */
export function SessionFilterChips({
  chips,
  onClear,
}: {
  chips: { key: SessionFacet; label: string }[];
  onClear: (key: SessionFacet) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1 px-3 pb-2">
      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          removeLabel={t('sessions.filters.remove')}
          onRemove={() => onClear(chip.key)}
        >
          {chip.label}
        </FilterChip>
      ))}
    </div>
  );
}
