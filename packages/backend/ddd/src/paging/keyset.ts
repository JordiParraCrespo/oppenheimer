/**
 * Keyset ("seek") paging: a list ordered on a unique `(key, id)` resumes after
 * the last row it returned with one row comparison, so a page costs the same
 * however deep it is and a row written between two pages is neither skipped
 * nor read twice.
 *
 * The key travels as the text Postgres printed for it, cast back in the
 * comparison: a `timestamptz` keeps microseconds and a JavaScript `Date` only
 * milliseconds, so a key that went through a `Date` would skip the rows that
 * share its millisecond.
 *
 * ```ts
 * const order: KeysetOrder = {
 *   key: '"session"."createdAt"',
 *   keyType: 'timestamptz',
 *   id: '"session"."id"',
 *   idType: 'uuid',
 *   direction: 'DESC',
 * };
 * if (cursor) {
 *   const after = keysetAfter(order, cursor);
 *   query.andWhere(after.sql, after.params);
 * }
 * query.addSelect(`(${order.key})::text`, 'sortKey');
 * const rows = await query.orderBy(order.key, 'DESC').addOrderBy(order.id, 'DESC')
 *   .limit(limit + 1).getRawAndEntities();
 * const page = keysetPage(rowsOf(rows), limit, (row) => ({ key: row.sortKey, id: row.id }));
 * ```
 */

/** Where the next page starts: the last row's sort key, as Postgres printed it, and its id. */
export interface KeysetCursor {
  key: string;
  id: string;
}

/** One page, and the cursor for the one after it; `next` is null on the last page. */
export interface KeysetPage<T> {
  items: T[];
  next: KeysetCursor | null;
}

/** A list's order on `(key, id)`, both in one direction. */
export interface KeysetOrder {
  /** The sort key's SQL expression. */
  key: string;
  /** The type the key's printed text casts back to (`timestamptz`, `text`, `bigint`). */
  keyType: string;
  /** The tiebreaker's SQL expression: unique, so `(key, id)` is. */
  id: string;
  /** The tiebreaker's type (`uuid`, `bigint`). */
  idType: string;
  direction: 'ASC' | 'DESC';
}

/**
 * The predicate that keeps only the rows after `cursor` in `order`, with its
 * named parameters (`:<param>Key`, `:<param>Id`) for a TypeORM query builder.
 */
export function keysetAfter(
  order: KeysetOrder,
  cursor: KeysetCursor,
  param = 'cursor',
): { sql: string; params: Record<string, string> } {
  const comparison = order.direction === 'DESC' ? '<' : '>';
  return {
    sql: `(${order.key}, ${order.id}) ${comparison} (CAST(:${param}Key AS ${order.keyType}), CAST(:${param}Id AS ${order.idType}))`,
    params: { [`${param}Key`]: cursor.key, [`${param}Id`]: cursor.id },
  };
}

/**
 * A page from rows read with `LIMIT limit + 1`: the first `limit` of them, and
 * a cursor after the last one only when the extra row says there is more, so
 * "is there another page" costs no count.
 */
export function keysetPage<T>(
  rows: readonly T[],
  limit: number,
  cursorOf: (row: T) => KeysetCursor,
): KeysetPage<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, next: rows.length > limit && last ? cursorOf(last) : null };
}
