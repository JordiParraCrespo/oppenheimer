import type { CodingAgentLoginTarget } from './catalog';

/**
 * The login URL check, derived from the catalog's `loginTargets`.
 *
 * One builder for both uses of it: each agent's own pattern, which the link
 * narrows a reported URL to, and the union over every agent, which is the form
 * that survives emission to JSON Schema. The targets are hosts, so the pattern
 * is host **equality** — `https://`, the host, then the end of the URL or a
 * path — and never a substring a longer host could contain (F3). A target with
 * a `path` admits only that path and what continues it at a `/`, `?` or `#`
 * boundary, which is how GitHub is a login host at `/login/device` and nowhere
 * else.
 */
export function loginUrlPattern(targets: readonly CodingAgentLoginTarget[]): string {
  const unique = [
    ...new Map(targets.map((target) => [`${target.host}${target.path ?? ''}`, target])).values(),
  ];
  const alternatives = unique.map((target) =>
    target.path
      ? `${escapeRegExp(target.host)}${escapeRegExp(target.path)}(?:[/?#][^\\s]*)?`
      : `${escapeRegExp(target.host)}(?:/[^\\s]*)?`,
  );
  return `^https://(?:${alternatives.join('|')})$`;
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
