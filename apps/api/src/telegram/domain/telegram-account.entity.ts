import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { TELEGRAM_LABEL_MAX, type TelegramAccountStatus } from '@oppenheimer/shared';
import { type TelegramTokenRefusal, telegramTokenRefusal } from './telegram-token.policy';

export interface TelegramAccountProps {
  organizationId: string;
  /** Whose bot it is. Only they, and their Oppenheimer bots, read and write in it. */
  userId: string;
  /** The host whose runner holds the token and polls the Bot API. One Telegram bot per host. */
  hostId: string;
  /** What the person and their bots call it: "Shop", "Family". */
  label: string;
  status: TelegramAccountStatus;
  /** The Telegram bot's own user id, once the host checked its token. */
  botId: string | null;
  /** The Telegram bot's `@username`, without the `@`. */
  username: string | null;
  /** The Telegram bot's name, as @BotFather has it. */
  displayName: string | null;
  /** Why it is revoked or unlinked, in the runner's words. */
  statusReason: string | null;
  /**
   * The Oppenheimer bot that answers the owner here
   * (`product/next-steps/answering-on-telegram-and-whatsapp.md` §1); null
   * while none does.
   */
  answeringBotId: string | null;
  /** The owner's Telegram user id, recorded by the one-time `start` link; null until then. */
  ownerTelegramId: string | null;
  /** The SHA-256 of the open `start` link's code, and when it stops working; null when none is open. */
  ownerLinkCodeHash: string | null;
  ownerLinkExpiresAt: Date | null;
}

/** How long a `start` link records the owner. */
export const TELEGRAM_OWNER_LINK_TTL_MS = 10 * 60_000;

/** A `start` link's code as stored: never the code itself. */
export function hashTelegramOwnerCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** What the runner reported about its bot (`telegram.state`). */
export interface TelegramBotReport {
  state: TelegramAccountStatus;
  botId?: string;
  username?: string;
  name?: string;
  reason?: string;
}

/**
 * A Telegram bot the person made with @BotFather, polled by the runner on one
 * of their hosts (`product/next-steps/telegram.md`). The token stays on the
 * host; this is what the control plane knows of it: where it lives, what it
 * is called, and how the host last said it stands.
 */
export class TelegramAccountEntity extends AggregateRoot<TelegramAccountProps> {
  /** A report of another Telegram bot forgot the owner: the next save writes that. */
  private forgotOwner = false;

  static create(create: CreateEntityProps<TelegramAccountProps>): TelegramAccountEntity {
    return new TelegramAccountEntity(create);
  }

  /** A new bot on a host, waiting for the host to check its token. */
  static link(props: {
    organizationId: string;
    userId: string;
    hostId: string;
    label: string;
  }): TelegramAccountEntity {
    return new TelegramAccountEntity({
      id: randomUUID(),
      props: {
        ...props,
        label: props.label.trim() || 'Telegram',
        status: 'connecting',
        botId: null,
        username: null,
        displayName: null,
        statusReason: null,
        answeringBotId: null,
        ownerTelegramId: null,
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
  get hostId(): string {
    return this.props.hostId;
  }
  get label(): string {
    return this.props.label;
  }
  get status(): TelegramAccountStatus {
    return this.props.status;
  }
  get botId(): string | null {
    return this.props.botId;
  }
  get username(): string | null {
    return this.props.username;
  }
  get displayName(): string | null {
    return this.props.displayName;
  }
  get statusReason(): string | null {
    return this.props.statusReason;
  }
  get isConnected(): boolean {
    return this.props.status === 'connected';
  }
  get answeringBotId(): string | null {
    return this.props.answeringBotId;
  }
  get ownerTelegramId(): string | null {
    return this.props.ownerTelegramId;
  }
  get ownerLinkCodeHash(): string | null {
    return this.props.ownerLinkCodeHash;
  }
  get ownerLinkExpiresAt(): Date | null {
    return this.props.ownerLinkExpiresAt;
  }

  /** Whether a report forgot the owner since it was loaded (`report`). */
  get ownerForgotten(): boolean {
    return this.forgotOwner;
  }

  /** Whether a Telegram user is the owner this account recorded. */
  isOwner(telegramUserId: string): boolean {
    return this.props.ownerTelegramId !== null && this.props.ownerTelegramId === telegramUserId;
  }

  /** The Oppenheimer bot that answers here from now on; null for none. */
  answerAs(botId: string | null): void {
    this.props.answeringBotId = botId;
    this.setUpdatedAt(new Date());
  }

  /**
   * A new one-time `start` link: its code, which only this request sees,
   * replaces any open one and records the owner when they open it within
   * `TELEGRAM_OWNER_LINK_TTL_MS`.
   */
  openOwnerLink(now: Date): { code: string; expiresAt: Date } {
    const code = randomBytes(16).toString('base64url');
    const expiresAt = new Date(now.getTime() + TELEGRAM_OWNER_LINK_TTL_MS);
    this.props.ownerLinkCodeHash = hashTelegramOwnerCode(code);
    this.props.ownerLinkExpiresAt = expiresAt;
    this.setUpdatedAt(now);
    return { code, expiresAt };
  }

  /**
   * `/start <code>` from a Telegram user: when the code is the open link's
   * and has not expired, that user becomes the owner and the link is used
   * up. Anything else changes nothing.
   */
  claimOwner(code: string, telegramUserId: string, now: Date): boolean {
    const { ownerLinkCodeHash, ownerLinkExpiresAt } = this.props;
    if (!ownerLinkCodeHash || !ownerLinkExpiresAt || ownerLinkExpiresAt <= now) return false;
    if (hashTelegramOwnerCode(code) !== ownerLinkCodeHash) return false;
    this.props.ownerTelegramId = telegramUserId;
    this.props.ownerLinkCodeHash = null;
    this.props.ownerLinkExpiresAt = null;
    this.setUpdatedAt(now);
    return true;
  }

  /** Connect again with a token: the host checks it and reports back. The label stays unless given. */
  reconnect(label?: string): void {
    if (label?.trim()) this.props.label = label.trim();
    this.props.status = 'connecting';
    this.props.statusReason = null;
    this.validate();
    this.setUpdatedAt(new Date());
  }

  /** The host would not take a new token: how the account stands is `telegramTokenRefusal`'s. */
  refuseToken(refusal: TelegramTokenRefusal, statusBefore: TelegramAccountStatus): void {
    const outcome = telegramTokenRefusal(refusal, statusBefore);
    this.props.status = outcome.status;
    this.props.statusReason = outcome.statusReason;
    this.setUpdatedAt(new Date());
  }

  /**
   * The host's report replaces what was known. The bot's id, username and
   * name are kept once learned, so a report that does not repeat them does
   * not forget them.
   */
  report(report: TelegramBotReport): void {
    this.props.status = report.state;
    // Another Telegram bot on this account (a new token for a different bot)
    // has never met the owner: they open a `start` link again.
    if (report.botId && this.props.botId && report.botId !== this.props.botId) {
      this.props.ownerTelegramId = null;
      this.forgotOwner = true;
    }
    if (report.botId) this.props.botId = report.botId;
    if (report.username) this.props.username = report.username;
    if (report.name) this.props.displayName = report.name;
    this.props.statusReason = report.reason ?? null;
    this.setUpdatedAt(new Date());
  }

  public validate(): void {
    const { label } = this.props;
    if (!label || label.length > TELEGRAM_LABEL_MAX) {
      throw new ArgumentInvalidException(`label must be 1 to ${TELEGRAM_LABEL_MAX} characters`);
    }
  }
}
