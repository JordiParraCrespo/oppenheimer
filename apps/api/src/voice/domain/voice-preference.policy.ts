/**
 * The order a walk tries its providers in: the one the workspace chose
 * first, then the rest in their usual order. The others stay after it, so a
 * choice whose key was removed, or whose provider fails, still leaves the
 * workspace heard and spoken for.
 */
export function chosenFirst<T extends { readonly id: string }>(
  providers: readonly T[],
  chosen: string | null,
): T[] {
  const first = providers.find((provider) => provider.id === chosen);
  return first ? [first, ...providers.filter((provider) => provider !== first)] : [...providers];
}
