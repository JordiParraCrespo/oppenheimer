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

/**
 * What a host row says about itself, in one word — the Settings hosts list's
 * right-hand column. Derived on read from three facts, never stored:
 *
 * - `unpaired` — removed, from either end. Only a read that asked for
 *   unpaired hosts ever sees it;
 * - `offline` — no heartbeat inside the online window;
 * - `running` — online, with at least one session whose agent is up;
 * - `idle` — online, with nothing running on it.
 *
 * The order is the precedence: an unpaired host is never also offline, and an
 * offline host is never "running" on the strength of sessions it cannot hear.
 */
export const HOST_STATUSES = ['running', 'idle', 'offline', 'unpaired'] as const;

export type HostStatus = (typeof HOST_STATUSES)[number];

export const hostStatusSchema = z.enum(HOST_STATUSES);

/**
 * `GET /hosts`. Unpaired hosts are left out unless asked for: Settings lists
 * the machines a session can still start on, and a removed host there reads
 * as one that came back. The sidebar asks for them, because a session that ran
 * on a host removed since still needs that host's name.
 */
export const listHostsQuerySchema = z.object({
  include: z.literal('unpaired').optional(),
});

export type ListHostsQueryDto = z.infer<typeof listHostsQuerySchema>;
