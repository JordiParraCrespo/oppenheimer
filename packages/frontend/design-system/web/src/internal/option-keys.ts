import type * as React from 'react';

/**
 * Arrow keys for a picker's search box whose caller keeps no highlight of its
 * own (`ChipSelect` and a few others do, and handle the keys first).
 *
 * The focus stays in the search, so typing still filters: ↑ and ↓ move a
 * `data-active` mark across the pane's enabled options, and Enter clicks the
 * marked one (`chooseActive`). The mark lives on the DOM rather than in state because the
 * rows belong to whichever component drew them.
 */
const ACTIVE = 'data-active';

function paneOf(input: HTMLElement) {
  return input.closest<HTMLElement>('[data-slot="chip-select-content"]');
}

function optionsIn(pane: HTMLElement) {
  return Array.from(
    pane.querySelectorAll<HTMLElement>(
      '[role="option"]:not([data-disabled]):not([disabled]):not([aria-disabled="true"])',
    ),
  );
}

function clearActive(pane: HTMLElement | null) {
  if (!pane) return;
  for (const el of pane.querySelectorAll(`[${ACTIVE}]`)) el.removeAttribute(ACTIVE);
}

/**
 * Enter on a row the arrows marked: clicks it and says so. It runs before the
 * caller's own handler, because a caller that picks its first row on Enter
 * (the task's Link existing) would otherwise take a row the reader never chose.
 */
function chooseActive(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key !== 'Enter') return false;
  const pane = paneOf(event.currentTarget);
  const marked = pane ? optionsIn(pane).find((el) => el.hasAttribute(ACTIVE)) : undefined;
  if (!marked) return false;
  event.preventDefault();
  marked.click();
  return true;
}

function moveActive(event: React.KeyboardEvent<HTMLInputElement>) {
  const pane = paneOf(event.currentTarget);
  if (!pane) return;
  const options = optionsIn(pane);
  const current = options.findIndex((el) => el.hasAttribute(ACTIVE));

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    if (options.length === 0) return;
    const next =
      event.key === 'ArrowDown'
        ? Math.min(current + 1, options.length - 1)
        : current === -1
          ? options.length - 1
          : Math.max(current - 1, 0);
    clearActive(pane);
    const target = options[next];
    target?.setAttribute(ACTIVE, '');
    target?.scrollIntoView({ block: 'nearest' });
  }
}

export { chooseActive, clearActive, moveActive, paneOf };
