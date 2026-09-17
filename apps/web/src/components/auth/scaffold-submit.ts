/**
 * Where the auth screens hand off while they are scaffolds. The forms
 * validate through their Zod schemas as they will in the product; the
 * backend call is not wired yet, so the values are shown in a browser alert
 * instead. Replace the call sites with the frontend package's hooks when the
 * API is connected.
 */
export function scaffoldSubmit(action: string, values: Record<string, unknown> = {}) {
  window.alert(`${action}\n\n${JSON.stringify(values, null, 2)}`);
}
