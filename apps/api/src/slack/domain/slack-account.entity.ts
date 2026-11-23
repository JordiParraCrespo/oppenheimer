import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import type { SlackAccountStatus } from '@oppenheimer/shared';

export interface SlackAccountProps {
  organizationId: string;
  /** Who connected it: the bot's maker, the only person it answers. */
  userId: string;
  /** The Oppenheimer bot this Slack app is. One app per bot. */
  botId: string;
  status: SlackAccountStatus;
  /** Why it is revoked, in Slack's words. */
  statusReason: string | null;
  /** The Slack workspace the app is installed in. */
  teamId: string;
  teamName: string;
  /** The app's bot user: who a mention names, and whose messages are the app's own. */
  botUserId: string;
  botName: string;
  /** The bot token and signing secret, sealed under `SLACK_TOKEN_KEY`. */
  sealedBotToken: Buffer;
  sealedSigningSecret: Buffer;
  /** The token's last characters, to tell two apart. */
  tokenHint: string;
  /** The owner's Slack user id, recorded by the one-time `link` code; null until then. */
  ownerSlackUserId: string | null;
  /** The SHA-256 of the open code, and when it stops working; null when none is open. */
  ownerLinkCodeHash: string | null;
  ownerLinkExpiresAt: Date | null;
}

/** What Slack said about a bot token (`auth.test`). */
export interface SlackIdentity {
  teamId: string;
  teamName: string;
  botUserId: string;
  botName: string;
}

/** How long a `link` code records the owner. */
export const SLACK_OWNER_LINK_TTL_MS = 10 * 60_000;

/** A `link` code as stored: never the code itself. */
export function hashSlackOwnerCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** The last characters of a bot token, shown to tell two apart. */
export function slackTokenHintOf(token: string): string {
  return token.slice(-4);
}

/**
 * A bot's own Slack app, installed in one Slack workspace: its sealed bot
 * token and signing secret, who it is in Slack, and the one Slack user it
 * answers, its owner.
 */
export class SlackAccountEntity extends AggregateRoot<SlackAccountProps> {
  static create(create: CreateEntityProps<SlackAccountProps>): SlackAccountEntity {
    return new SlackAccountEntity(create);
  }

  /** A bot's Slack app, its token checked by Slack: connected, and its owner not met yet. */
  static connect(props: {
    organizationId: string;
    userId: string;
    botId: string;
    identity: SlackIdentity;
    sealedBotToken: Buffer;
    sealedSigningSecret: Buffer;
    tokenHint: string;
  }): SlackAccountEntity {
    const { identity, ...rest } = props;
    return new SlackAccountEntity({
      id: randomUUID(),
      props: {
        ...rest,
        ...identity,
        status: 'connected',
        statusReason: null,
        ownerSlackUserId: null,
        ownerLinkCodeHash: null,
        ownerLinkExpiresAt: null,
      },
    });
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get status(): SlackAccountStatus {
    return this.props.status;
  }
  get statusReason(): string | null {
    return this.props.statusReason;
  }
  get teamId(): string {
    return this.props.teamId;
  }
  get teamName(): string {
    return this.props.teamName;
  }
  get botUserId(): string {
    return this.props.botUserId;
  }
  get botName(): string {
    return this.props.botName;
  }
  get sealedBotToken(): Buffer {
    return this.props.sealedBotToken;
  }
  get sealedSigningSecret(): Buffer {
    return this.props.sealedSigningSecret;
  }
  get tokenHint(): string {
    return this.props.tokenHint;
  }
  get ownerSlackUserId(): string | null {
    return this.props.ownerSlackUserId;
  }
  get ownerLinkCodeHash(): string | null {
    return this.props.ownerLinkCodeHash;
  }
  get ownerLinkExpiresAt(): Date | null {
    return this.props.ownerLinkExpiresAt;
  }
  get isConnected(): boolean {
    return this.props.status === 'connected';
  }

  /**
   * New credentials for the same bot. Another Slack app, or the same app in
   * another workspace, has never met the owner: they send a `link` code again.
   */
  replaceCredentials(next: {
    identity: SlackIdentity;
    sealedBotToken: Buffer;
    sealedSigningSecret: Buffer;
    tokenHint: string;
  }): void {
    const sameApp =
      next.identity.teamId === this.props.teamId &&
      next.identity.botUserId === this.props.botUserId;
    Object.assign(this.props, next.identity, {
      sealedBotToken: next.sealedBotToken,
      sealedSigningSecret: next.sealedSigningSecret,
      tokenHint: next.tokenHint,
      status: 'connected',
      statusReason: null,
    });
    if (!sameApp) this.props.ownerSlackUserId = null;
    this.setUpdatedAt(new Date());
  }

  /** Slack refused the token on a call: it reads `revoked` until connected again. */
  revoke(reason: string): void {
    this.props.status = 'revoked';
    this.props.statusReason = reason.slice(0, 200);
    this.setUpdatedAt(new Date());
  }

  /** Whether a Slack user is the owner this app recorded. */
  isOwner(slackUserId: string): boolean {
    return this.props.ownerSlackUserId !== null && this.props.ownerSlackUserId === slackUserId;
  }

  /**
   * A new one-time code: only this request sees it; it replaces any open one
   * and records the owner when they send it within `SLACK_OWNER_LINK_TTL_MS`.
   */
  openOwnerLink(now: Date): { code: string; expiresAt: Date } {
    const code = randomBytes(9).toString('base64url');
    const expiresAt = new Date(now.getTime() + SLACK_OWNER_LINK_TTL_MS);
    this.props.ownerLinkCodeHash = hashSlackOwnerCode(code);
    this.props.ownerLinkExpiresAt = expiresAt;
    this.setUpdatedAt(now);
    return { code, expiresAt };
  }

  /**
   * `link <code>` from a Slack user: when the code is the open one's and has
   * not expired, that user becomes the owner and the code is used up.
   * Anything else changes nothing.
   */
  claimOwner(code: string, slackUserId: string, now: Date): boolean {
    const { ownerLinkCodeHash, ownerLinkExpiresAt } = this.props;
    if (!ownerLinkCodeHash || !ownerLinkExpiresAt || ownerLinkExpiresAt <= now) return false;
    if (hashSlackOwnerCode(code) !== ownerLinkCodeHash) return false;
    this.props.ownerSlackUserId = slackUserId;
    this.props.ownerLinkCodeHash = null;
    this.props.ownerLinkExpiresAt = null;
    this.setUpdatedAt(now);
    return true;
  }

  /** An app is always someone in a workspace: Slack named both when its token was checked. */
  public validate(): void {
    if (!this.props.teamId || !this.props.botUserId) {
      throw new ArgumentInvalidException('A Slack app needs its workspace and its bot user');
    }
  }
}
