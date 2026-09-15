import { z } from 'zod';
import { SCOPES, type Scope } from '../scopes';

/** Zod enum over the scope catalog, so DTOs reject anything unknown. */
export const scopeSchema = z.enum(SCOPES as unknown as [Scope, ...Scope[]]);

/**
 * An IPv4/IPv6 address or CIDR block. Deliberately permissive on the address
 * itself (Node validates it properly at match time) while rejecting obvious
 * junk and prefixes outside the legal range.
 */
const ipOrCidrSchema = z
  .string()
  .trim()
  .min(2)
  .max(49)
  .refine((value) => {
    const [address, prefix, ...rest] = value.split('/');
    if (rest.length > 0) return false;
    if (prefix !== undefined) {
      if (!/^\d{1,3}$/.test(prefix)) return false;
      const bits = Number(prefix);
      const max = address.includes(':') ? 128 : 32;
      if (bits > max) return false;
    }
    return address.includes(':')
      ? /^[0-9a-fA-F:.]+$/.test(address)
      : /^\d{1,3}(\.\d{1,3}){3}$/.test(address);
  }, 'Must be an IPv4/IPv6 address or CIDR block');

export const createApiTokenSchema = z.object({
  /** Human-readable label shown in the token list. */
  name: z.string().trim().min(1).max(80),
  /** Permissions to grant. Must be a subset of what the creator may grant. */
  scopes: z.array(scopeSchema).min(1, 'Select at least one permission'),
  /**
   * Restrict the token to these organizations. Omit (or pass an empty array)
   * to let it follow the owner's memberships.
   */
  organizationIds: z.array(z.string().uuid()).max(50).optional(),
  /** Lifetime in days. `null` mints a non-expiring token. */
  expiresInDays: z.number().int().min(1).max(3650).nullable().optional(),
  /** Optional source-IP allowlist (addresses or CIDR blocks). */
  ipAllowlist: z.array(ipOrCidrSchema).max(20).optional(),
});

export const apiTokenResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** Non-secret display prefix, e.g. `oppenheimer_pat_a1b2c3d4`. */
  prefix: z.string(),
  scopes: z.array(scopeSchema),
  /** `null` when the token follows the owner's organization memberships. */
  organizationIds: z.array(z.string().uuid()).nullable(),
  ipAllowlist: z.array(z.string()).nullable(),
  expiresAt: z.string().datetime().nullable(),
  lastUsedAt: z.string().datetime().nullable(),
  revokedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

/**
 * Returned only by the create call. The secret is shown once and never stored
 * in recoverable form — only a SHA-256 digest is persisted.
 */
export const createApiTokenResponseSchema = apiTokenResponseSchema.extend({
  token: z.string(),
});

export type CreateApiTokenDto = z.infer<typeof createApiTokenSchema>;
export type ApiTokenResponse = z.infer<typeof apiTokenResponseSchema>;
export type CreateApiTokenResponse = z.infer<typeof createApiTokenResponseSchema>;
