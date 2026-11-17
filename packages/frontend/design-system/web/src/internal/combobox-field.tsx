'use client';

import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import * as React from 'react';

import { inputVariants } from '../components/input';
import { ComboboxScope, takeFirstOnEnter } from './combobox-scope';
import { cn } from '../lib/utils';

/**
 * `Input`'s shell (its size, `quiet`, a leading glyph) around a
 * `ChipSelectCombobox`'s input, for a pane whose search is drawn as a field
 * rather than as `ChipSelectSearch`'s row: `SearchList`, the engine button.
 * The query lives on the combobox, so it takes no value of its own.
 */
function ComboboxField({
  size = 'md',
  quiet,
  leading,
  className,
  onKeyDown,
  ...props
}: {
  size?: 'sm' | 'md';
  quiet?: boolean;
  leading?: React.ReactNode;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const scope = React.useContext(ComboboxScope);
  return (
    <div data-slot="input" data-size={size} className={cn(inputVariants({ size, quiet }), className)}>
      {leading ? (
        <span data-slot="input-leading" className="flex shrink-0 text-fg-subtle">
          {leading}
        </span>
      ) : null}
      <ComboboxPrimitive.Input
        // biome-ignore lint/a11y/noAutofocus: the search is the reason the pane opened
        autoFocus
        data-slot="input-control"
        className="min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-inherit tracking-inherit outline-none placeholder:text-field-placeholder"
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) takeFirstOnEnter(scope, event);
        }}
        {...props}
      />
    </div>
  );
}

export { ComboboxField };
