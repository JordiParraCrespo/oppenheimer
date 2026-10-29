/**
 * What the relay's gateways bind into and the dispatcher reads from: which host
 * holds a live link right now, and the link itself.
 */
export const LINK_REGISTRY = Symbol('LINK_REGISTRY');

/** Where a pasted image waits for its host to pull it (`ParkedFilePort`). */
export const PARKED_FILES = Symbol('PARKED_FILES');

/** Staged uploads read without parking them (`StagedFileReaderPort`), from the same store. */
export const STAGED_FILE_READER = Symbol('STAGED_FILE_READER');

/**
 * Request and response over a runner link (`LinkRepliesPort`): the waiters for
 * a reply, settled by the gateway that reads the runner's frames.
 */
export const LINK_REPLIES = Symbol('LINK_REPLIES');
