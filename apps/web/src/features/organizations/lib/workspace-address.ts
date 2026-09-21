/**
 * The address a workspace is reached at.
 *
 * One definition, because two screens print it: the step that claims the
 * address and the summary that repeats it back. A console served from another
 * origin printing `oppenheimer.dev/` under the field is the same class of bug
 * as the installer fetching `get.oppenheimer.dev` — a hosted default standing
 * in for the deployment actually running.
 *
 * The origin is this console's own, which is where a workspace is reached in
 * any deployment. `oppenheimer.dev/` remains what the artboards show, because
 * that is the origin they were drawn for.
 */
export function workspaceAddressPrefix(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.host}/`;
}

/** The full address for a slug, for the copy that quotes it back. */
export function workspaceAddress(slug: string): string {
  return `${workspaceAddressPrefix()}${slug}`;
}
