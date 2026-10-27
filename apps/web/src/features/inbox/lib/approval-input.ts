/** The most fields an approval card shows of a call's input. */
const MAX_FIELDS = 6;
/** The most characters a field's value takes before it is cut. */
const MAX_VALUE = 200;

function shown(value: unknown): string {
  const text = typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value));
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1).trimEnd()}…` : text;
}

/**
 * A bot's call as the approval card shows it: one `key: value` line per field
 * of its input, a string as written and anything else as compact JSON, each
 * value cut at 200 characters and the call at six fields, with "…" where it
 * was cut. Empty when the call takes no input.
 */
export function formatApprovalInput(input: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(input);
  const lines = entries.slice(0, MAX_FIELDS).map(([key, value]) => `${key}: ${shown(value)}`);
  if (entries.length > MAX_FIELDS) lines.push('…');
  return lines.join('\n');
}
