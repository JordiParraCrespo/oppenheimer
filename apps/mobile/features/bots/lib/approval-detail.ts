/**
 * The one line under an approval that says what the call acts on: the
 * command it runs, else the file, the address or the query it names. None
 * when the input names none of them; the card's summary says it in words.
 */
export function approvalDetail(input: Readonly<Record<string, unknown>>): string | null {
  for (const key of ['command', 'cmd', 'path', 'file_path', 'url', 'query'] as const) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
