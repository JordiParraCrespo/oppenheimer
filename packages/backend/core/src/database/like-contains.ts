/**
 * A `LIKE` / `ILIKE` pattern matching `term` anywhere, with the term's own
 * `%`, `_` and `\` escaped so they match literally: a search for `a_b` must not
 * match `axb`, and a search for `%` must not match every row.
 *
 * The backslash is Postgres' default `LIKE` escape character (with
 * `standard_conforming_strings` on, the default), so no `ESCAPE` clause is
 * needed. Bind the result as a parameter (`ILike(likeContains(term))`); this
 * escapes wildcards, it is not an SQL-injection defence.
 */
export function likeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
