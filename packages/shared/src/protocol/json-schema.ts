import { z } from 'zod/v4';
import { protocolMessageSchema } from './messages';
import { PROTOCOL_VERSION } from './version';

/**
 * Emit the link's JSON Schema from the Zod union.
 *
 * This is the one seam where the wire leaves TypeScript: the committed
 * `protocol-schema/protocol.schema.json` is what the Go structs in
 * `packages/go/protocol` are generated from (runner slice R2). One source, two
 * languages, no hand-written twin — which is what open question 1 of
 * `product/versions/mvp/01-protocol.md` was asking for.
 *
 * `io: 'input'` because the schema describes what a peer may **send**: it is
 * what a defaulted field looks like before the default applies.
 * `unrepresentable: 'any'` because two constraints genuinely have no JSON
 * Schema form — the 8 KB cap on an event payload is a refinement, and a
 * validator that cannot express it must not refuse the whole document over it.
 * Both stay enforced by the Zod parse on the control plane.
 */
export function toProtocolJsonSchema(): Record<string, unknown> {
  const emitted = z.toJSONSchema(protocolMessageSchema, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'any',
  });

  return {
    $id: `https://oppenheimer.dev/schemas/protocol/v${PROTOCOL_VERSION}/protocol.schema.json`,
    title: 'Oppenheimer runner link protocol',
    description:
      'Control messages on the runner link. PTY bytes travel as binary frames and are not described here.',
    ...emitted,
  };
}
