/**
 * `SESSION_DISPATCH` is what `links/` binds to send a session's work to a host;
 * this module imports that binding rather than providing one. The other direction
 * is the published surface `relay/` calls: `RECORD_SESSION_EVENTS` with a runner's
 * batch, `SESSION_LOOKUP` to redeem an attach ticket or a credential ask, and
 * `SESSION_RECONCILIATION` with a runner's hello.
 */
export const WORK_SESSION_REPOSITORY = Symbol('WORK_SESSION_REPOSITORY');
export const SESSION_DISPATCH = Symbol('SESSION_DISPATCH');
export const RECORD_SESSION_EVENTS = Symbol('RECORD_SESSION_EVENTS');
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');
export const SESSION_RECONCILIATION = Symbol('SESSION_RECONCILIATION');
export const SESSION_SHARE_LINK_REPOSITORY = Symbol('SESSION_SHARE_LINK_REPOSITORY');
