'use client';

import { CircleAlertIcon, HandIcon, ShieldCheckIcon } from 'lucide-react';
import * as React from 'react';

import { ComposerToolButton } from './composer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

/**
 * PermissionMenu — what the agent may do on the host without asking, as a
 * muted tool button in the composer's foot row and a menu of three two-line
 * options, each with its glyph: a hand for "Ask for approval", a shield for
 * "Approve for me", an alert ring for "Full access". Full access is the one
 * level that can change a machine unattended, so it is the only one that
 * takes the warning tone, on the button and on its row, label and all.
 *
 * The levels are the product's; pass them in so the copy is translated where
 * the call site is. Picking one closes the menu: unlike the appearance and
 * language menus a radio group is usually built for, this is a decision made
 * once on the way to sending a task, not a setting somebody flips to compare.
 */
type PermissionLevel = 'ask' | 'auto' | 'full';

type PermissionOption = {
  value: PermissionLevel;
  label: string;
  description: string;
};

/**
 * The three glyphs, twice, because the export draws them at two sizes: 14px on
 * the button in the composer's foot row, 16px on the menu's rows
 * (`SessionsConsole`'s `.op-permbtn` and `.op-permrow`). An explicit `size-*`
 * is also what keeps the row's own `[&_svg]` default from reaching them.
 */
const TRIGGER_ICONS: Record<PermissionLevel, React.ReactNode> = {
  ask: <HandIcon className="size-3.5" />,
  auto: <ShieldCheckIcon className="size-3.5" />,
  full: <CircleAlertIcon className="size-3.5" />,
};

const ROW_ICONS: Record<PermissionLevel, React.ReactNode> = {
  ask: <HandIcon className="size-4" />,
  auto: <ShieldCheckIcon className="size-4" />,
  full: <CircleAlertIcon className="size-4" />,
};

/**
 * One row, at the export's density: 5px/10px padding, a 13px label over an
 * 11.5px line, the check on the first line. Denser than the console's other
 * menus on purpose — this one hangs off a 30px button in the composer's foot
 * row rather than off the sidebar.
 */
const ROW_CLASSES =
  // `pr-7` rather than the menu's own `pr-8`: the export reserves the width of
  // its inline tick, not a fixed gutter, and the row's text column is 224px
  // wide because of it. Twenty-eight is that column plus clearance for a check
  // the app positions absolutely instead.
  'gap-2.5 py-[5px] pr-7 text-[13px] [&_[data-slot=radio-description]]:text-[11.5px] [&_[data-slot=radio-description]]:leading-[1.47] [&_[data-slot=radio-indicator]]:top-[5px]';

function PermissionMenu({
  options,
  value,
  onValueChange,
  disabled,
  className,
  'aria-label': ariaLabel = 'Permission level',
}: {
  options: PermissionOption[];
  value: PermissionLevel;
  onValueChange: (value: PermissionLevel) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}) {
  const current = options.find((option) => option.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <ComposerToolButton
            icon={TRIGGER_ICONS[value]}
            tone={value === 'full' ? 'warning' : 'muted'}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
          />
        }
      >
        {current?.label}
      </DropdownMenuTrigger>
      {/* 296px wide, not merely at least: the export's rows wrap their second
          line rather than widening the menu, and a fixed width is the only way
          a translated sentence keeps doing that. */}
      <DropdownMenuContent side="top" align="start" className="w-[296px]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onValueChange(next as PermissionLevel)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              icon={ROW_ICONS[option.value]}
              tone={option.value === 'full' ? 'warning' : 'default'}
              description={option.description}
              className={ROW_CLASSES}
              // Picking a level is a decision, not a comparison, so the menu
              // closes behind it — Base UI keeps a radio item's menu open by
              // default, which left the composer's send button behind an inert
              // backdrop until somebody clicked away.
              closeOnClick
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { PermissionMenu };
export type { PermissionLevel, PermissionOption };
