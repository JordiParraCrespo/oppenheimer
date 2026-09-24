/**
 * DI tokens for the links module.
 *
 * `LINK_REGISTRY` is the one the relay's gateways bind into and the dispatcher
 * reads from: which host holds a live link right now, and the link itself.
 */
export const LINK_REGISTRY = Symbol('LINK_REGISTRY');

/** Where a pasted image waits for its host to pull it (`ParkedImagePort`). */
export const PARKED_IMAGES = Symbol('PARKED_IMAGES');
