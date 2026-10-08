import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  SHARE_LINK_LIFETIME_MS,
  type ShareLinkAccess,
  type ShareLinkAudience,
  type ShareLinkLifetime,
} from '@oppenheimer/shared';

/** Bytes of entropy in a link's secret: 256 bits, 43 base64url characters. */
const SHARE_TOKEN_BYTES = 32;

export interface SessionShareLinkProps {
  organizationId: string;
  sessionId: string;
  /**
   * Who shared it, and whose access the link acts with: every attach through
   * it is judged as this person's, so their losing the session or the host
   * ends the link without anybody revoking it.
   */
  createdByUserId: string;
  /** SHA-256 of the secret, in hex. The secret itself is never stored. */
  tokenHash: string;
  access: ShareLinkAccess;
  audience: ShareLinkAudience;
  /** Lowercased emails; empty unless `audience` is `people`. */
  people: string[];
  label: string | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface IssueShareLinkProps {
  organizationId: string;
  sessionId: string;
  createdByUserId: string;
  access: ShareLinkAccess;
  audience: ShareLinkAudience;
  people?: string[];
  lifetime?: ShareLinkLifetime | null;
  label?: string;
  now?: Date;
}

/** Who is opening a link: an account, or nobody signed in. */
export interface ShareLinkViewer {
  userId: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Why a link does not open for this viewer: `gone` (unknown, revoked or
 * expired, which a holder cannot tell apart and need not), `sign_in` (the
 * audience needs an account and nobody is signed in), `not_invited` (signed
 * in, and not on the list).
 */
export type ShareLinkRefusal = 'gone' | 'sign_in' | 'not_invited';

/**
 * A link that opens one session's terminal to people outside its workspace.
 *
 * It carries no authority of its own: what it opens is what its creator could
 * open at that moment, narrowed to one session and, for `read`, to watching.
 */
export class SessionShareLinkEntity extends AggregateRoot<SessionShareLinkProps> {
  static create(create: CreateEntityProps<SessionShareLinkProps>): SessionShareLinkEntity {
    return new SessionShareLinkEntity(create);
  }

  /** A new link, and its secret: the only time the secret exists. */
  static issue(props: IssueShareLinkProps): { link: SessionShareLinkEntity; token: string } {
    const now = props.now ?? new Date();
    const token = randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
    const people =
      props.audience === 'people'
        ? [...new Set((props.people ?? []).map((email) => email.trim().toLowerCase()))].sort()
        : [];
    const link = new SessionShareLinkEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        sessionId: props.sessionId,
        createdByUserId: props.createdByUserId,
        tokenHash: hashShareToken(token),
        access: props.access,
        audience: props.audience,
        people,
        label: props.label?.trim() || null,
        expiresAt: props.lifetime
          ? new Date(now.getTime() + SHARE_LINK_LIFETIME_MS[props.lifetime])
          : null,
        revokedAt: null,
      },
    });
    return { link, token };
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get createdByUserId(): string {
    return this.props.createdByUserId;
  }

  get tokenHash(): string {
    return this.props.tokenHash;
  }

  get access(): ShareLinkAccess {
    return this.props.access;
  }

  get audience(): ShareLinkAudience {
    return this.props.audience;
  }

  get people(): string[] {
    return this.props.people;
  }

  get label(): string | null {
    return this.props.label;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get readOnly(): boolean {
    return this.props.access === 'read';
  }

  isLive(now: Date = new Date()): boolean {
    if (this.props.revokedAt !== null) return false;
    return this.props.expiresAt === null || this.props.expiresAt.getTime() > now.getTime();
  }

  /**
   * Why this viewer may not open the link now, or `null` if they may. A list
   * of people is matched on a verified email only: an unverified address is a
   * claim anybody could make at sign-up.
   */
  refusalFor(viewer: ShareLinkViewer | null, now: Date = new Date()): ShareLinkRefusal | null {
    if (!this.isLive(now)) return 'gone';
    if (this.props.audience === 'anyone') return null;
    if (!viewer) return 'sign_in';
    if (this.props.audience === 'accounts') return null;
    const email = viewer.email.trim().toLowerCase();
    return viewer.emailVerified && this.props.people.includes(email) ? null : 'not_invited';
  }

  /** Idempotent: a revoked link stays revoked at its first time. */
  revoke(now: Date = new Date()): void {
    if (this.props.revokedAt !== null) return;
    this.props.revokedAt = now;
  }

  validate(): void {
    if (this.props.audience === 'people' && this.props.people.length === 0) {
      throw new ArgumentNotProvidedException('A link for specific people must name one');
    }
  }
}

/** SHA-256 of a presented secret, in hex: what a lookup compares. */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
