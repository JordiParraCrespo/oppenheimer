import { z } from 'zod';

/**
 * Host shapes. A host belongs to a **person**, not a workspace: one laptop is
 * paired once and every workspace its owner is in borrows it
 * (`product/versions/mvp/10-api-modules-and-data-model.md`).
 *
 * Schemas state the constraint only, never a message: an explicit string would
 * pin every consumer to English (see `.agents/rules/forms.md`).
 */

/** The display name a host is given, both at pairing time and on rename. */
const hostNameSchema = z.string().min(1).max(80);

/**
 * `POST /hosts/pairing`. The machine is named *before* it exists — the token
 * carries the intended name and the host adopts it at registration, so nobody
 * has to rename a box that defaulted to its hostname.
 */
export const mintPairingTokenSchema = z.object({
  name: hostNameSchema,
});

export type MintPairingTokenDto = z.infer<typeof mintPairingTokenSchema>;

/**
 * `POST /hosts/register`, the first of the runner's two HTTP calls. This is the
 * runner's `RegisterRequest` exactly
 * (`apps/runner/internal/pairing/app/ports.go`): the registration token, the
 * name the runner detected, the host's Ed25519 public key, and an opaque bag
 * of host facts the pairing context only forwards.
 *
 * The public key travels with the token so a retry after a dropped response is
 * idempotent: redemption and host insert commit together, and a second attempt
 * with the same fingerprint returns the same host.
 */
export const registerHostSchema = z.object({
  token: z.string().min(1),
  name: hostNameSchema,
  /** Base64, as the runner encodes the raw Ed25519 key. */
  publicKey: z.string().min(1).base64(),
  /**
   * Host inventory — tools, versions, detected agents, disk. Opaque on the
   * wire and stored as jsonb on `host.capabilities`; a hint for the console,
   * never a gate.
   */
  facts: z.record(z.unknown()).optional(),
});

export type RegisterHostDto = z.infer<typeof registerHostSchema>;

/** `PATCH /hosts/{id}`. The name is display-only; nothing on disk derives from it. */
export const renameHostSchema = z.object({
  name: hostNameSchema,
});

export type RenameHostDto = z.infer<typeof renameHostSchema>;
