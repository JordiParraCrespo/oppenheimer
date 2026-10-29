import {
  ChipSelectPopup,
  InlineToken,
  Popover,
  PopoverTrigger,
  SearchList,
  type SearchListOption,
} from '@oppenheimer/design-system-web';
import { useState } from 'react';

/**
 * `ChoiceToken` over a list the workspace grows: the runs list's Automation
 * and Project facets. The same token, blue while it narrows, opening the
 * Bots picker's search list (`SearchList`) rather than radio rows; a pick
 * closes it. A fixed set (a window, a frequency) stays a `ChoiceToken`.
 */
export function SearchChoiceToken({
  label,
  value,
  options,
  dirty,
  searchPlaceholder,
  emptyText,
  onValueChange,
}: {
  label: string;
  value: string;
  options: SearchListOption[];
  dirty?: boolean;
  searchPlaceholder: string;
  emptyText: (query: string) => string;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <InlineToken size="sm" dirty={dirty} open={open} title={label} className="max-w-52" />
        }
      >
        {label}
      </PopoverTrigger>
      <ChipSelectPopup density="menu" align="end" className="p-0">
        <SearchList
          options={options}
          value={value}
          onPick={(option) => {
            onValueChange(option.value);
            setOpen(false);
          }}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
        />
      </ChipSelectPopup>
    </Popover>
  );
}
