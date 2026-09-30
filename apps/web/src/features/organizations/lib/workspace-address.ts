/**
 * The address a workspace is reached at, defined once because two screens
 * print it. The origin is this console's own, never a hosted default: a
 * console on another origin printing `oppenheimer.dev/` is the same bug as the
 * installer fetching `get.oppenheimer.dev`. The artboards show
 * `oppenheimer.dev/` only because that is the origin they were drawn for.
 */
export function workspaceAddressPrefix(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.host}/`;
}

export function workspaceAddress(slug: string): string {
  return `${workspaceAddressPrefix()}${slug}`;
}
