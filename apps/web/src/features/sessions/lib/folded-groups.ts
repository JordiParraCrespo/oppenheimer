/**
 * The sidebar's project groups the reader folded, kept on this device like
 * the pins (`session-pins.ts`): the groups' keys, a project's id or
 * `unfiled`. A fold is the reader's, so the API never hears of it.
 */
export const FOLDED_GROUPS_KEY = 'oppenheimer.sidebar.folded';

/**
 * Whether the reader folded the sidebar's whole Sessions list away, kept on
 * this device beside the groups' folds: the list holds `sessions` while it is.
 */
export const FOLDED_SESSIONS_KEY = 'oppenheimer.sidebar.sessions-folded';
