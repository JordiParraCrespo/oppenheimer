// What both lanes of the agentic UI eval read off a run: which blocks carry
// figures, and how many of a visual's numbers the answer said again.

/** Blocks that draw figures: a visual made of one without data to read invents it. */
export const NUMERIC_BLOCKS = new Set([
  'metrics',
  'bar',
  'line',
  'area',
  'ring',
  'ranking',
  'table',
  'progress',
]);

/** Every number in a value, walked whole. */
function numbersIn(value: unknown, into: Set<number>): Set<number> {
  if (typeof value === 'number' && Number.isFinite(value)) into.add(value);
  else if (Array.isArray(value)) for (const item of value) numbersIn(item, into);
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) numbersIn(item, into);
  }
  return into;
}

/**
 * How many of the visuals' figures the answer writes out again. Small whole
 * numbers (under 10) are left out: "3 of them" or "the 2 hosts" is a word,
 * not a repeated figure.
 */
export function echoedNumbers(visuals: readonly unknown[], answer: string): number {
  const figures = [...numbersIn(visuals, new Set())].filter((n) => Math.abs(n) >= 10);
  const said = new Set(
    (answer.match(/-?\d[\d,]*(?:\.\d+)?/g) ?? []).map((token) => Number(token.replace(/,/g, ''))),
  );
  return figures.filter((n) => said.has(n)).length;
}
