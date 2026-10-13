import { randomBytes, randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  ArgumentOutOfRangeException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  SESSION_SHARE_LIFETIME_MS,
  type SessionShareAccess,
  type SessionShareAudience,
  type SessionShareLifetime,
  sessionShareLifetimeAllowed,
} from '@oppenheimer/shared';

/** Bytes of entropy in a share's address: 128 bits, 22 base64url characters. */
const SHARE_SLUG_BYTES = 16;

export interface SessionShareProps {
  organizationId: string;
  sessionId: string;
  /**
   * Who last set how the session is shared, and whose access the share acts
   * with: every attach through it is judged as this person's, so their losing
   * the session or the host ends it without anybody stopping it.
   */
  sharedByUserId: string;
  /** The address, `/s/<slug>`. Stable while the share lives; a new share gets a new one. */
  slug: string;
  audience: SessionShareAudience;
  access: SessionShareAccess;
  /** Lowercased emails, sorted; empty unless `audience` is `people`. */
  people: string[];
  expiresAt: Date | null;
}

/** How a session is shared: the choices `PUT /sessions/{id}/share` takes. */
export interface SessionShareSettings {
  audience: SessionShareAudience;
  access: SessionShareAccess;
  people?: string[];
  lifetime: SessionShareLifetime | null;
}

/** Who is opening a share: an account, or nobody signed in. */
export interface SessionShareViewer {
  userId: string;
  email: string;
  emailVerified: boolean;
}

/**
 * Why a share does not open for this viewer: `gone` (expired, which a guest
 * cannot tell from never shared and need not), `not_invited` (not on the
 * list). Nobody signed in is asked to sign in before any share is read.
 */
export type SessionShareRefusal = 'gone' | 'not_invited';

function normalisedPeople(people: string[] | undefined): string[] {
  return [...new Set((people ?? []).map((email) => email.trim().toLowerCase()))].sort();
}

/** The props a share's settings set, or why they cannot be set. */
function settingsProps(
  sharedByUserId: string,
  settings: SessionShareSettings,
  now: Date,
): Pick<SessionShareProps, 'sharedByUserId' | 'audience' | 'access' | 'people' | 'expiresAt'> {
  if (!sessionShareLifetimeAllowed(settings.access, settings.lifetime)) {
    throw new ArgumentOutOfRangeException('Write access ends within 24 hours');
  }
  if (settings.audience === 'link' && settings.access !== 'read') {
    throw new ArgumentInvalidException('A link only watches; write access names people');
  }
  return {
    sharedByUserId,
    audience: settings.audience,
    access: settings.access,
    people: settings.audience === 'people' ? normalisedPeople(settings.people) : [],
    expiresAt: settings.lifetime
      ? new Date(now.getTime() + SESSION_SHARE_LIFETIME_MS[settings.lifetime])
      : null,
  };
}

/**
 * How one session's terminal is opened to people outside its workspace. A
 * session has at most one; stopping it deletes it.
 *
 * It carries no authority of its own: what it opens is what the person who
 * shared it could open at that moment, narrowed to one session's agent
 * window and, for `read`, to watching.
 */
export class SessionShareEntity extends AggregateRoot<SessionShareProps> {
  static create(create: CreateEntityProps<SessionShareProps>): SessionShareEntity {
    return new SessionShareEntity(create);
  }

  /** A new share, at a new address. */
  static share(props: {
    organizationId: string;
    sessionId: string;
    sharedByUserId: string;
    settings: SessionShareSettings;
    now?: Date;
  }): SessionShareEntity {
    return new SessionShareEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        sessionId: props.sessionId,
        slug: randomBytes(SHARE_SLUG_BYTES).toString('base64url'),
        ...settingsProps(props.sharedByUserId, props.settings, props.now ?? new Date()),
      },
    });
  }

  /**
   * Replace how the session is shared, keeping its address: the people on
   * the list, what they may do and until when all become what was asked,
   * and the share now acts as whoever asked.
   */
  reshare(byUserId: string, settings: SessionShareSettings, now: Date = new Date()): void {
    Object.assign(this.props, settingsProps(byUserId, settings, now));
    this.validate();
  }

  /** Narrow a `people` share's list, leaving everything else as it is. */
  setPeople(people: string[]): void {
    if (this.props.audience !== 'people') {
      throw new ArgumentInvalidException('Only a share for specific people names people');
    }
    this.props.people = normalisedPeople(people);
    this.validate();
  }

  get organizationId(): string {
    return this.props.organizationId;
  }

  get sessionId(): string {
    return this.props.sessionId;
  }

  get sharedByUserId(): string {
    return this.props.sharedByUserId;
  }

  get slug(): string {
    return this.props.slug;
  }

  get audience(): SessionShareAudience {
    return this.props.audience;
  }

  get access(): SessionShareAccess {
    return this.props.access;
  }

  get people(): string[] {
    return this.props.people;
  }

  get expiresAt(): Date | null {
    return this.props.expiresAt;
  }

  get readOnly(): boolean {
    return this.props.access === 'read';
  }

  isLive(now: Date = new Date()): boolean {
    return this.props.expiresAt === null || this.props.expiresAt.getTime() > now.getTime();
  }

  /**
   * Why this viewer may not open the share now, or `null` if they may. A
   * list of people is matched on a verified email only: an unverified address
   * is a claim anybody could make at sign-up.
   */
  refusalFor(viewer: SessionShareViewer, now: Date = new Date()): SessionShareRefusal | null {
    if (!this.isLive(now)) return 'gone';
    if (this.props.audience === 'link') return null;
    const email = viewer.email.trim().toLowerCase();
    return viewer.emailVerified && this.props.people.includes(email) ? null : 'not_invited';
  }

  validate(): void {
    if (this.props.audience === 'people' && this.props.people.length === 0) {
      throw new ArgumentNotProvidedException('A share for specific people must name one');
    }
  }
}
