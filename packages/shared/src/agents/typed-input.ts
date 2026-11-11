import type { CodingAgentInput } from './catalog.js';

/** What every agent CLI here takes: Enter to send, Escape to interrupt, 200 ms. */
export const TYPED_INPUT: CodingAgentInput = Object.freeze({
  submit: '\r',
  stop: '\u001b',
  pasteGapMs: 200,
});
