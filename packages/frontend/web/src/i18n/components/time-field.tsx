import {
  Button,
  ChipSelectPopup,
  Popover,
  PopoverTrigger,
  TimeGrid,
} from '@oppenheimer/design-system-web';
import { ChevronDown, Clock } from '@oppenheimer/design-system-web/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

/**
 * A time of day, `HH:MM` on a quarter-hour grid: the hour, then the minute, in
 * one popover the way the automation editor's time token picks one. `after`
 * disables every time at or before it (an event's end after its start).
 */
export function TimeField({
  value,
  onChange,
  after,
  clearable = false,
  id,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  after?: string | null;
  clearable?: boolean;
  id?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState<string | null>(value?.slice(0, 2) ?? null);
  const shownHour = hour ?? value?.slice(0, 2) ?? null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setHour(value?.slice(0, 2) ?? null);
        setOpen(next);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="secondary"
            size="sm"
            className="justify-start gap-2"
          />
        }
      >
        <Clock aria-hidden />
        <span className={value ? 'figures font-mono text-fg' : 'text-fg-subtle'}>
          {value ?? t('common.timeField.none')}
        </span>
        <ChevronDown aria-hidden className="ml-1 text-fg-subtle" />
      </PopoverTrigger>
      <ChipSelectPopup width={292} maxHeight={420}>
        <div className="flex flex-col gap-2 p-2">
          <TimeGrid
            columns={6}
            groups={[
              {
                label: t('common.timeField.hour'),
                cells: HOURS.map((h) => ({
                  value: h,
                  label: h,
                  disabled: Boolean(after && `${h}:45` <= after),
                })),
              },
            ]}
            value={shownHour}
            onValueChange={setHour}
          />
          {shownHour ? (
            <TimeGrid
              columns={4}
              groups={[
                {
                  label: t('common.timeField.minute'),
                  cells: MINUTES.map((m) => ({
                    value: `${shownHour}:${m}`,
                    label: `:${m}`,
                    disabled: Boolean(after && `${shownHour}:${m}` <= after),
                  })),
                },
              ]}
              value={value}
              onValueChange={(time) => {
                onChange(time);
                setOpen(false);
              }}
            />
          ) : null}
          {clearable && value ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {t('common.timeField.clear')}
            </Button>
          ) : null}
        </div>
      </ChipSelectPopup>
    </Popover>
  );
}
