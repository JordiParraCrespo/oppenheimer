import * as React from 'react';

/**
 * What a `ChipSelectCombobox` tells the parts inside it: that they draw as
 * its parts, where its list is, and whether Enter with nothing lit takes the
 * first row.
 */
type ComboboxScopeValue = {
  registerList: (list: HTMLElement | null) => void;
  list: HTMLElement | null;
  /** The pane opens on a choice to make (`autoHighlight="always"`). */
  firstOnEnter: boolean;
};

const ComboboxScope = React.createContext<ComboboxScopeValue | null>(null);

/**
 * Enter in a pane that opens on a choice, with no row lit: the combobox lights
 * the first row when it mounts, but not when the rows land later (a list still
 * loading when the popup opened, a search the API answers). Rather than
 * remount the field under the caret to light it, Enter takes the first row
 * itself, as the pickers did before the combobox. Runs before Base UI's own
 * handler, which does nothing when no row is lit.
 */
function takeFirstOnEnter(
  scope: ComboboxScopeValue | null,
  event: React.KeyboardEvent<HTMLInputElement>,
) {
  if (!scope?.firstOnEnter || !scope.list || event.key !== 'Enter') return;
  // Base UI's own Enter ignores a modified one, and so does this.
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  // An IME confirming its text (Safari says so with 229 rather than isComposing).
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
  if (event.currentTarget.getAttribute('aria-activedescendant')) return;
  const first = scope.list.querySelector<HTMLElement>(
    '[role="option"]:not([aria-disabled="true"]):not([data-disabled])',
  );
  if (!first) return;
  event.preventDefault();
  first.click();
}

export { ComboboxScope, takeFirstOnEnter };
export type { ComboboxScopeValue };
