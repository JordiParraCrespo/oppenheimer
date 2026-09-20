/**
 * DI tokens for the sessions module.
 *
 * Two of them are published surface. `SESSION_DISPATCH` is what the module that
 * owns the runner link binds to send a session's work to a host; until it exists
 * the binding is a no-op adapter that records the job as owed.
 * `RECORD_SESSION_EVENTS` is the other direction — what that module calls with a
 * runner's batch — and it is a port rather than a raw command so the relay does not
 * have to know which slice handles it.
 */
export const WORK_SESSION_REPOSITORY = Symbol('WORK_SESSION_REPOSITORY');
export const SESSION_DISPATCH = Symbol('SESSION_DISPATCH');
export const RECORD_SESSION_EVENTS = Symbol('RECORD_SESSION_EVENTS');
export const SESSION_NAMER = Symbol('SESSION_NAMER');
