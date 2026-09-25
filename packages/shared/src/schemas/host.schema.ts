import { z } from 'zod';
import { hostFactsSchema, hostNameSchema } from './primitives';

/**
 * Host shapes. A host belongs to a **person**, not a workspace: one laptop is
 * paired once and every workspace its owner is in borrows it.
 *
 * Schemas state the constraint only, never a message (`.agents/rules/forms.md`).
 */

/**
 * `POST /hosts/pairing`. The machine is named *before* it exists — the token
 * carries the intended name and the host adopts it at registration, so nobody
 * has to rename a box that defaulted to its hostname.
 */
export const mintPairingTokenSchema = z.object({
  name: hostNameSchema,
  /**
   * The caller's token this one replaces: Add host's "New token". It is revoked
   * in the same write that mints the new one, so a failed mint leaves it
   * spendable and a failed revoke mints nothing.
   */
  replaces: z.string().uuid().optional(),
});

export type MintPairingTokenDto = z.infer<typeof mintPairingTokenSchema>;

/**
 * `POST /hosts/register`, the first of the runner's two HTTP calls: the
 * registration token, the name the runner detected, the host's Ed25519 public
 * key, and the host's facts.
 *
 * The public key travels with the token so a retry after a dropped response is
 * idempotent: redemption and host insert commit together, and a second attempt
 * with the same fingerprint returns the same host.
 *
 * `facts` is the **same `hostFactsSchema` the link's `hello` and `heartbeat`
 * carry**, not an opaque bag. Registration and the link describe one machine, so
 * they validate one shape.
 */
export const registerHostSchema = z.object({
  token: z.string().min(1),
  name: hostNameSchema,
  /** Base64, as the runner encodes the raw Ed25519 key. */
  publicKey: z.string().min(1).base64(),
  facts: hostFactsSchema.optional(),
});

export type RegisterHostDto = z.infer<typeof registerHostSchema>;

/** `PATCH /hosts/{id}`. The name is display-only; nothing on disk derives from it. */
export const renameHostSchema = z.object({
  name: hostNameSchema,
});

export type RenameHostDto = z.infer<typeof renameHostSchema>;
