/**
 * Base class for queries. A query is a read-only request dispatched through the
 * CQRS query bus to its handler. Queries have no side effects and may bypass
 * the domain layer to read from optimized read models.
 */
export class QueryBase {}
