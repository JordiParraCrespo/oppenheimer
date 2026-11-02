/** The fence languages that say a block holds JSON. */
const JSON_LANGUAGES = new Set(['json', 'jsonc', 'json5']);

/** An ISO 8601 date and time with its zone, as an API or a config writes one. */
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function parse(text: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(text) };
  } catch {
    return null;
  }
}

/**
 * A run of `"key": value` pairs lifted out of a larger object (what an agent
 * writes to say "change these two fields"), read as that object.
 */
function parseFieldRun(text: string): { value: unknown } | null {
  if (!text.startsWith('"')) return null;
  return parse(`{${text.replace(/,\s*$/, '')}}`);
}

/**
 * What a fenced block holds as JSON, or null when it is not JSON: a block
 * fenced `json` (or `jsonc`, `json5`) that parses, or a block with no
 * language that parses to an object or an array. A `json` block that is a
 * run of `"key": value` pairs out of a larger object (what an agent writes
 * to say "change these two fields") is read as that object. A scalar alone
 * is not worth a tree.
 */
export function readJsonBlock(
  code: string,
  language: string | undefined,
): { value: unknown } | null {
  const name = language?.trim().split(/\s+/)[0]?.toLowerCase();
  const text = code.trim();
  if (!text) return null;
  if (name && !JSON_LANGUAGES.has(name)) return null;
  const whole = parse(text);
  if (whole && typeof whole.value === 'object' && whole.value !== null) return whole;
  // Only a fence that says JSON and did not parse is tried as a run of fields.
  return name && !whole ? parseFieldRun(text) : null;
}

/** The instant a JSON string names, when it is an ISO date and time with its zone. */
export function isoTimeOf(value: unknown): Date | null {
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time;
}
