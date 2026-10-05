import {
  ChipSelectPopup,
  InlineToken,
  Popover,
  PopoverTrigger,
  TimeGrid,
} from '@oppenheimer/design-system-web';
import { useState } from 'react';

export interface GridPane {
  label: string;
  columns: 4 | 5 | 6 | 7;
  cells: { value: string; label: string; disabled?: boolean; sans?: boolean }[];
  value: string | null;
  onValueChange: (value: string) => void;
  /** Close the popover after a pick in this pane (the last pane of a time). */
  closes?: boolean;
}

/**
 * A token whose choices are a grid: a time (hours, then minutes), the
 * minute past the hour, a day of the month, a date. One or more panes in a
 * 292px popover, as `TimeGrid` asks to be drawn.
 */
export function GridToken({
  label,
  panes,
  mono = true,
}: {
  label: string;
  panes: GridPane[];
  mono?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<InlineToken mono={mono} open={open} />}>{label}</PopoverTrigger>
      <ChipSelectPopup width={292} maxHeight={420}>
        {/* The popup's own 4px, plus 8px: the grids sit 12px in. */}
        <div className="flex flex-col gap-2 p-2">
          {panes.map((pane) => (
            <TimeGrid
              key={pane.label}
              groups={[{ label: pane.label, cells: pane.cells }]}
              columns={pane.columns}
              value={pane.value}
              onValueChange={(value) => {
                pane.onValueChange(value);
                if (pane.closes) setOpen(false);
              }}
            />
          ))}
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}
