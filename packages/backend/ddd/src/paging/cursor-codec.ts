/**
 * A list cursor as the client holds it: opaque base64url, so its shape can
 * change without a client noticing. One encoding for every list: base64url of
 * a JSON object of strings, named by the list (`{ s, k, i }` for the sessions
 * list: its sort, key and id).
 *
 * `decode` also reads the older `|`-joined form (`<key>|<id>`, the host
 * timeline's), so a cursor a client already holds keeps working when its list
 * moves to this codec: the parts are named positionally.
 */
export const CursorCodec = {
  encode(fields: Readonly<Record<string, string>>): string {
    return Buffer.from(JSON.stringify(fields), 'utf8').toString('base64url');
  },

  /**
   * The named fields of a cursor this API issued, or null for anything else:
   * the list decides whether a bad cursor is a 400 or the first page.
   */
  decode<N extends string>(text: string, names: readonly N[]): Record<N, string> | null {
    if (!text) return null;
    const raw = Buffer.from(text, 'base64url').toString('utf8');
    if (raw.startsWith('{')) return fromJson(raw, names);
    const parts = raw.split('|');
    if (parts.length !== names.length || parts.some((part) => part === '')) return null;
    return Object.fromEntries(names.map((name, index) => [name, parts[index]])) as Record<
      N,
      string
    >;
  },
};

function fromJson<N extends string>(raw: string, names: readonly N[]): Record<N, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  const fields: Partial<Record<N, string>> = {};
  for (const name of names) {
    const value = (parsed as Record<string, unknown>)[name];
    if (typeof value !== 'string') return null;
    fields[name] = value;
  }
  return fields as Record<N, string>;
}
