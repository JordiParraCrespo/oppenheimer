/**
 * The wire, and only the wire.
 *
 * `./json-schema` is deliberately absent: `toProtocolJsonSchema` exists for the
 * build step that writes `protocol-schema/protocol.schema.json`, and the script
 * imports it directly (`dist/protocol/json-schema.js`). Re-exporting it here
 * would drag `z.toJSONSchema` into every runtime peer that only needs to parse a
 * message.
 */
export * from './attach.js';
export * from './hint.js';
export * from './link.js';
export * from './messages.js';
export * from './primitives.js';
export * from './runner-files.js';
export * from './session-file.js';
export * from './session-step.js';
export * from './version.js';
