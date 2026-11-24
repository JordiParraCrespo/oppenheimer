/**
 * What both tiers need to drive a session's agent the way a person would, with
 * no schema behind it: the keys that answer its pickers and dialogs.
 */
// What names one occurrence of a session waiting on a person, for the Inbox
// and the Chrome extension alike.
export * from './occurrence-keys.js';
export * from './permission-keys.js';
export * from './question-keys.js';
// What a client of the API (`opp`, the MCP server) builds a launch from and
// decides a wait by.
export * from './session-launch.js';
export * from './session-wait.js';
