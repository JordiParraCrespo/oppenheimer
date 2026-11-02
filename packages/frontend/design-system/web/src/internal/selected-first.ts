/**
 * The rows a picker shows, with the ones already chosen first, in the order
 * they were chosen, and the rest in the order they came. A picker passes
 * what was chosen when its popup opened, not what is chosen now, so a row
 * picked while it is open stays under the pointer.
 */
export function selectedFirst<T>(
  rows: readonly T[],
  chosen: readonly string[],
  keyOf: (row: T) => string,
): T[] {
  if (chosen.length === 0) return [...rows];
  const rank = new Map(chosen.map((key, index) => [key, index]));
  const lead = rows
    .filter((row) => rank.has(keyOf(row)))
    .sort((a, b) => (rank.get(keyOf(a)) ?? 0) - (rank.get(keyOf(b)) ?? 0));
  return [...lead, ...rows.filter((row) => !rank.has(keyOf(row)))];
}
