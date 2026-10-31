import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { SESSION_SORTS, type SessionSortDto } from '@oppenheimer/shared';

/**
 * Where a keyset walk of the list stands: the sort it was issued for, the last
 * row's sort key as Postgres printed it, and the last row's id.
 */
export interface SessionListCursor {
  sort: SessionSortDto;
  key: string;
  id: string;
}

/** What `decodeSessionListCursor` accepts as a session id, before Postgres casts it. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The list's cursor as the client holds it: opaque, base64url JSON of the sort
 * it was issued for, the last row's sort key and its id. The key is the text
 * Postgres printed, never a JavaScript `Date`, because a `Date` keeps
 * milliseconds and a `timestamptz` keeps microseconds — a truncated key would
 * skip the rows that share its millisecond.
 */
export function encodeSessionListCursor(cursor: SessionListCursor): string {
  return Buffer.from(
    JSON.stringify({ s: cursor.sort, k: cursor.key, i: cursor.id }),
    'utf8',
  ).toString('base64url');
}

/**
 * A cursor back from the client, for the sort it is now asking in. Anything
 * that is not one this API issued for that sort is a 400: a cursor issued
 * for `recent` compared against `name` keys would page through nonsense.
 */
export function decodeSessionListCursor(text: string, sort: SessionSortDto): SessionListCursor {
  const invalid = () =>
    new ArgumentInvalidException('`cursor` is not a cursor this list issued for this sort');
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(text, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (typeof parsed !== 'object' || parsed === null) throw invalid();
  const { s, k, i } = parsed as { s?: unknown; k?: unknown; i?: unknown };
  if (
    typeof s !== 'string' ||
    !(SESSION_SORTS as readonly string[]).includes(s) ||
    typeof k !== 'string' ||
    typeof i !== 'string' ||
    !UUID_PATTERN.test(i)
  ) {
    throw invalid();
  }
  if (s !== sort) {
    throw new ArgumentInvalidException(
      `\`cursor\` was issued for sort \`${s}\`; this request sorts by \`${sort}\``,
    );
  }
  return { sort, key: k, id: i };
}
