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
 * the call site is.
 */
type PermissionLevel = 'ask' | 'auto' | 'full';

type PermissionOption = {
  value: PermissionLevel;
  label: string;
  description: string;
};

const ICONS: Record<PermissionLevel, React.ReactNode> = {
  ask: <HandIcon />,
  auto: <ShieldCheckIcon />,
  full: <CircleAlertIcon />,
};

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
            icon={ICONS[value]}
            tone={value === 'full' ? 'warning' : 'muted'}
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
          />
        }
      >
        {current?.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="min-w-[296px]">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onValueChange(next as PermissionLevel)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              icon={ICONS[option.value]}
              tone={option.value === 'full' ? 'warning' : 'default'}
              description={option.description}
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
