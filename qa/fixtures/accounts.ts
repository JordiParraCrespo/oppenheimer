/**
 * The identities the fixtures own.
 *
 * Each fixture gets its own account and therefore its own workspace, which is
 * what lets the populated, enormous and empty states exist side by side in one
 * database. A scenario picks its state by signing in as the right person, not
 * by wiping the others.
 *
 * The addresses are deterministic so a rerun reuses the same rows, and
 * `@qa.oppenheimer.dev` is a distinct domain from the platform seed's `@oppenheimer.dev`
 * so a teardown can never mistake a seeded account for a QA one.
 */
export interface FixtureAccount {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

export const FIXTURE_ACCOUNTS = {
  baseline: {
    email: 'owner.baseline@qa.oppenheimer.dev',
    password: 'QaBaseline123',
    firstName: 'Bea',
    lastName: 'Baseline',
    organizationName: 'QA Baseline Workspace',
  },
  volume: {
    email: 'owner.volume@qa.oppenheimer.dev',
    password: 'QaVolume123',
    firstName: 'Vic',
    lastName: 'Volume',
    organizationName: 'QA Volume Workspace',
  },
  empty: {
    email: 'owner.empty@qa.oppenheimer.dev',
    password: 'QaEmpty123',
    firstName: 'Emi',
    lastName: 'Empty',
    organizationName: 'QA Empty Workspace',
  },
  roster: {
    email: 'owner.roster@qa.oppenheimer.dev',
    password: 'QaRoster123',
    firstName: 'Rosa',
    lastName: 'Roster',
    organizationName: 'QA Roster Workspace',
  },
} as const satisfies Record<string, FixtureAccount>;

export type FixtureName = keyof typeof FIXTURE_ACCOUNTS | 'reset';

/**
 * The cast the `roster` fixture stands up beside its owner.
 *
 * One holder of each kind of person the product can put someone in, so a
 * scenario can ask "what can this kind of person do" by signing in rather than
 * by constructing an ability object and hoping it matches.
 *
 * `platformRole` is the legacy `user.role` column, and it is the thing the
 * control plane gates on: `canAccessControlPlane` is about being a platform
 * administrator, not about being an administrator of a workspace. Exactly one
 * member of this cast holds it, which is what makes AUTH-08 a real question.
 *
 * The addresses start with `member` on purpose: the `reset` fixture spares that
 * prefix, so an auth scenario running between two others does not delete the
 * cast out from under them.
 */
export interface RosterMember {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** Better Auth's roster role, written to `member.role`. */
  organizationRole: 'admin' | 'member';
  /** The legacy platform column. `admin`/`superadmin` open the control plane. */
  platformRole: 'user' | 'admin';
}

export const ROSTER_CAST = [
  {
    email: 'member.admin.roster@qa.oppenheimer.dev',
    password: 'QaRosterAdmin123',
    firstName: 'Ada',
    lastName: 'Admin',
    organizationRole: 'admin',
    platformRole: 'user',
  },
  {
    email: 'member.plain.roster@qa.oppenheimer.dev',
    password: 'QaRosterPlain123',
    firstName: 'Pia',
    lastName: 'Plain',
    organizationRole: 'member',
    platformRole: 'user',
  },
  {
    email: 'member.platform.roster@qa.oppenheimer.dev',
    password: 'QaRosterPlatform123',
    firstName: 'Piet',
    lastName: 'Platform',
    organizationRole: 'member',
    platformRole: 'admin',
  },
] as const satisfies readonly RosterMember[];

/** Every address the pack is allowed to create, so teardown can be exhaustive. */
export const QA_EMAIL_DOMAIN = 'qa.oppenheimer.dev';

/**
 * Addresses the transient auth scenarios mint and must be able to mint again.
 *
 * Listed rather than derived: `reset` deletes exactly these, and a prefix rule
 * broad enough to catch them would also catch the fixture owners and the roster
 * cast, which own data the other scenarios are mid-way through reading.
 */
export const TRANSIENT_ACCOUNTS = [
  'reset.member@qa.oppenheimer.dev',
  'invitee.admin@qa.oppenheimer.dev',
  'invitee.member@qa.oppenheimer.dev',
  'newcomer@qa.oppenheimer.dev',
  'revoked.member@qa.oppenheimer.dev',
] as const;
