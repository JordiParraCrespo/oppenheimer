/** U+0000 anywhere, and a UTF-16 surrogate half that is not part of a pair. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: finding NUL is this pattern's job.
const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * `text` as Postgres stores it: every NUL dropped and every lone surrogate
 * half replaced with U+FFFD. Postgres refuses both, a NUL in `text`
 * (`invalid byte sequence for encoding "UTF8": 0x00`) and in `jsonb`
 * (`unsupported Unicode escape sequence`), and a lone half in `jsonb`
 * (`invalid input syntax for type json`). Text from outside carries them:
 * a PDF's text layer, a web page, a session's output.
 */
export function storableText(text: string): string {
  return text.replace(UNSTORABLE, (found) => (found === '\u0000' ? '' : '�'));
}

/** `value` with `storableText` applied to every string in it, keys included. */
export function storableJson<T>(value: T): T {
  return storableValue(value) as T;
}

function storableValue(value: unknown): unknown {
  if (typeof value === 'string') return storableText(value);
  if (Array.isArray(value)) return value.map(storableValue);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [storableText(key), storableValue(item)]),
    );
  }
  return value;
}
