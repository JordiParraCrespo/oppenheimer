import { z } from 'zod';

/**
 * The pieces a route's search schema is made of.
 *
 * A route's `validateSearch` is a Zod object and its search is exactly that
 * object: the router replaces the search with what the schema returns, so a key
 * it does not name is dropped, deliberately. A URL is typed by people and by
 * other sites, so a value of the wrong shape reads as absent (`catch`) rather
 * than failing the route — a mistyped link opens the page, not an error.
 */

/** An optional text param; empty or any other shape reads as absent. */
export const searchText = z.string().min(1).optional().catch(undefined);

/**
 * An on/off param. A link writes `1` or `true`, and the router re-validates its
 * own output, where the value is already `true`; every one of those reads as on.
 */
export const searchFlag = z
  .union([z.literal(true), z.literal('true'), z.literal(1), z.literal('1')])
  .transform((): true => true)
  .optional()
  .catch(undefined);

/** A positive whole number (a page), from the URL's text. */
export const searchPage = z.coerce.number().int().min(1).optional().catch(undefined);
