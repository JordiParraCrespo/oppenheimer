/**
 * What the relay's gateways bind into and the dispatcher reads from: which host
 * holds a live link right now, and the link itself.
 */
export const LINK_REGISTRY = Symbol('LINK_REGISTRY');

/** Where a pasted image waits for its host to pull it (`ParkedFilePort`). */
export const PARKED_FILES = Symbol('PARKED_FILES');
