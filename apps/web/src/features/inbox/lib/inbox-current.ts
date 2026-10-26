/**
 * The item in the pane: the one the address names while it is still in the
 * list, else the first. Clicking a row names it; answering or marking it
 * moves the pane on to whatever is first.
 */
export function currentItem<T extends { key: string }>(
  items: readonly T[],
  key: string | null,
): T | null {
  return (key ? items.find((item) => item.key === key) : undefined) ?? items[0] ?? null;
}
