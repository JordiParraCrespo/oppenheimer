import { FilterChip } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';

/**
 * What the filter menu narrows to, under the head (the frame's
 * `.op-filterchips`), each chip clearing its own facet. Without it a narrowed
 * list and an empty one look the same.
 */
export function InboxFilterChips({
  chips,
}: {
  chips: { key: string; label: string; onClear: () => void }[];
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-1 px-3 pb-2">
      {chips.map((chip) => (
        <FilterChip key={chip.key} removeLabel={t('inbox.filter.remove')} onRemove={chip.onClear}>
          {chip.label}
        </FilterChip>
      ))}
    </div>
  );
}
