import * as React from 'react';

/**
 * What a `ChipSelectCombobox` tells the parts inside it: that they draw as
 * its parts, where its list is, and what Enter does with nothing lit.
 */
type ComboboxScopeValue = {
  registerList: (list: HTMLElement | null) => void;
  list: HTMLElement | null;
  /** The pane opens on a choice to make (`autoHighlight="always"`). */
  firstOnEnter: boolean;
  /** The pane's own answer to Enter with nothing lit (the folder typed). */
  onEnterUnlit?: () => void;
};

const ComboboxScope = React.createContext<ComboboxScopeValue | null>(null);

/**
 * Enter with no row lit, which Base UI's own handler leaves alone in an inline
 * combobox. A pane that opens on a choice takes its first row: the combobox
 * lights it when it mounts, but not when the rows land later (a list still
 * loading when the popup opened, a search the API answers), and remounting
 * the field under the caret to light it would move the caret and drop what an
 * IME was composing. Any other pane gets its `onEnterUnlit`. Runs before Base
 * UI's handler, so it answers only the Enter that handler would ignore.
 */
function enterWithNothingLit(
  scope: ComboboxScopeValue | null,
  event: React.KeyboardEvent<HTMLInputElement>,
) {
  if (!scope || event.key !== 'Enter') return;
  // Base UI's own Enter ignores a modified one, and so does this.
  if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  // An IME confirming its text (Safari says so with 229 rather than isComposing).
  if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
  if (event.currentTarget.getAttribute('aria-activedescendant')) return;
  if (!scope.firstOnEnter) {
    if (!scope.onEnterUnlit) return;
    event.preventDefault();
    scope.onEnterUnlit();
    return;
  }
  const first = scope.list?.querySelector<HTMLElement>(
    '[role="option"]:not([aria-disabled="true"]):not([data-disabled])',
  );
  if (!first) return;
  event.preventDefault();
  first.click();
}

export { ComboboxScope, enterWithNothingLit };
export type { ComboboxScopeValue };
