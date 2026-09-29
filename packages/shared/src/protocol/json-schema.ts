import { z } from 'zod/v4';
import {
  ATTACHMENT_CREDIT_WINDOW_BYTES,
  LINK_FRAME_HEADER_BYTES,
  LINK_MAX_FRAME_BYTES,
  RUNNER_LINK_CLOSE_CODES,
  RUNNER_LINK_REFUSAL_HEADER,
  RUNNER_LINK_REFUSALS,
} from './link.js';
import {
  PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
  protocolMessageSchema,
  RUNNER_CAPABILITIES,
} from './messages.js';
import { PROTOCOL_VERSION } from './version.js';

/**
 * Emit the link's JSON Schema from the Zod union.
 *
 * **Build-only.** This module is not re-exported from `./index.ts`: the emitter
 * runs as part of `pnpm --filter @oppenheimer/shared build`, which writes
 * `protocol-schema/protocol.schema.json`, and nothing at runtime should pull
 * `z.toJSONSchema` in behind it.
 *
 * The artifact is committed because the Go structs are generated from it
 * (`scripts/emit-link-protocol.cjs` → `apps/runner/internal/link/protocol.gen.go`),
 * so a wire change is a reviewable diff. The emission is wired into `build`
 * rather than a separate script precisely so it cannot be the step someone
 * forgets.
 *
 * The link's constants ride along under `x-constants`, a vendor keyword JSON
 * Schema ignores: the close codes, the refusal header, the frame header, the
 * credit window and the frame cap are part of the contract too, and the Go side
 * is generated from this artifact alone rather than from a second hand-kept list.
 *
 * `io: 'input'` because the schema describes what a peer may **send**: it is what
 * a defaulted field looks like before the default applies. `reused: 'ref'` puts
 * a schema used by more than one message — the session snapshot — under `$defs`
 * once and `$ref`s it, so a field added to it cannot land in `hello` and miss
 * `heartbeat`.
 *
 * There is no `unrepresentable` escape hatch any more: the one constraint that
 * used to need it, the 8 KB cap on an event payload, is now `maxLength` on a JSON
 * string and survives the trip.
 */
export function toProtocolJsonSchema(): Record<string, unknown> {
  const emitted = z.toJSONSchema(protocolMessageSchema, {
    target: 'draft-2020-12',
    io: 'input',
    reused: 'ref',
  });

  return {
    $id: `https://oppenheimer.dev/schemas/protocol/v${PROTOCOL_VERSION}/protocol.schema.json`,
    title: 'Oppenheimer runner link protocol',
    description:
      'Control messages on the runner link. PTY bytes travel as binary frames and are not described here.',
    ...emitted,
    'x-constants': {
      protocolVersion: PROTOCOL_VERSION,
      closeCodes: RUNNER_LINK_CLOSE_CODES,
      refusalHeader: RUNNER_LINK_REFUSAL_HEADER,
      refusals: RUNNER_LINK_REFUSALS,
      frameHeaderBytes: LINK_FRAME_HEADER_BYTES,
      creditWindowBytes: ATTACHMENT_CREDIT_WINDOW_BYTES,
      maxFrameBytes: LINK_MAX_FRAME_BYTES,
      capabilities: RUNNER_CAPABILITIES,
      maxEventPayloadBytes: PROTOCOL_MAX_EVENT_PAYLOAD_BYTES,
    },
  };
}
