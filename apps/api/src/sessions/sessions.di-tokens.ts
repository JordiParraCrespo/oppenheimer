/**
 * DI tokens for the sessions module.
 *
 * Three of them are published surface. `SESSION_DISPATCH` is what `links/` binds
 * to send a session's work to a host over the runner link; this module imports
 * that binding rather than providing one. `RECORD_SESSION_EVENTS` is the other
 * direction — what `relay/` calls with a runner's batch — and it is a port rather
 * than a raw command so the relay does not have to know which slice handles it.
 * `SESSION_LOOKUP` is what the attach socket asks when it redeems a ticket.
 */
export const WORK_SESSION_REPOSITORY = Symbol('WORK_SESSION_REPOSITORY');
export const SESSION_DISPATCH = Symbol('SESSION_DISPATCH');
export const RECORD_SESSION_EVENTS = Symbol('RECORD_SESSION_EVENTS');
export const SESSION_LOOKUP = Symbol('SESSION_LOOKUP');
export const SESSION_RECONCILIATION = Symbol('SESSION_RECONCILIATION');
