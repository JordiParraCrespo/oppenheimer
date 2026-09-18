import {
  Badge,
  Button,
  Checkbox,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@oppenheimer/design-system-web';
import { ChevronDown, Filter } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type DataTableFacet, TABLE_HEADER_CONTROL_SIZE } from '../lib/data-table-types';

/**
 * One filter pill and its popover. Its own file because its open state is its
 * own: a reader picking a stage must not re-render the rows behind the popover.
 */
export function FacetFilter({ facet }: { facet: DataTableFacet }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const single = facet.mode === 'single';

  function toggle(value: string) {
    if (single) {
      // Picking the selected option again clears the filter, which is what the
      // "clear" row does — so the control has no dead click.
      facet.onChange(facet.value.includes(value) ? [] : [value]);
      // One choice is the whole interaction, so the popover gets out of the
      // way rather than sitting over the rows it just filtered. A multi-select
      // stays open: you are usually picking more than one.
      setOpen(false);
      return;
    }
    facet.onChange(
      facet.value.includes(value)
        ? facet.value.filter((entry) => entry !== value)
        : [...facet.value, value],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="secondary" size={TABLE_HEADER_CONTROL_SIZE} />}>
        <Filter />
        {facet.label}
        {facet.value.length > 0 && (
          <Badge variant="count" className="ml-0.5">
            {facet.value.length}
          </Badge>
        )}
        <ChevronDown />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5">
        {facet.options.map((option) => (
          <button
            key={option.value}
            type="button"
            // The dot and the checkbox are both `aria-hidden` decoration, so
            // the selected state has to live on the control itself — otherwise
            // a screen reader hears identical buttons before and after
            // choosing. `aria-pressed` rather than a menu role: these are plain
            // buttons in a popover, not a menu, and `aria-checked` is not valid
            // on one.
            aria-pressed={facet.value.includes(option.value)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-base text-ink-900 hover:bg-surface-hover"
            onClick={() => toggle(option.value)}
          >
            {single ? (
              <span
                aria-hidden
                className={cn(
                  'size-1.5 flex-none rounded-full',
                  facet.value.includes(option.value) ? 'bg-ink-900' : 'bg-transparent',
                )}
              />
            ) : (
              <Checkbox
                checked={facet.value.includes(option.value)}
                // The row is the control; the box only mirrors it.
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none"
              />
            )}
            {option.dotClassName && (
              <span className={cn('size-1.5 shrink-0 rounded-full', option.dotClassName)} />
            )}
            {option.label}
          </button>
        ))}
        {facet.value.length > 0 && (
          <button
            type="button"
            className="mt-1 w-full rounded-md border-t border-border-subtle px-2.5 pt-2.5 pb-2 text-left text-sm text-ink-600 hover:text-ink-900"
            onClick={() => facet.onChange([])}
          >
            {t('table.clearFilter')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
