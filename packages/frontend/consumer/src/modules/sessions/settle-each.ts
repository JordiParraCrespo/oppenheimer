/** How many of a bulk write's requests are in flight at once. */
const AT_ONCE = 4;

/**
 * A bulk write over several sessions (the selection bar's pin and move, Delete
 * all, a group's Hide all): `act` runs on each item, at most four at a time so
 * a long list does not land on the API as one burst, and a refusal does not
 * stop the rest. What comes back is the items it failed on, in their order,
 * and the first reason, which the caller shows. One policy for every bulk
 * write, so a partial failure reads the same wherever it happens.
 */
export async function settleEach<T>(
  items: readonly T[],
  act: (item: T) => Promise<unknown>,
): Promise<{ failed: T[]; reason: Error | null }> {
  const refused = new Map<number, unknown>();
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        await act(items[index] as T);
      } catch (error) {
        refused.set(index, error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, items.length) }, worker));
  const order = [...refused.keys()].sort((a, b) => a - b);
  const first = order.length > 0 ? refused.get(order[0] as number) : undefined;
  return {
    failed: order.map((index) => items[index] as T),
    reason: order.length === 0 ? null : first instanceof Error ? first : new Error(String(first)),
  };
}
