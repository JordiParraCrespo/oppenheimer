import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { TELEGRAM_LABEL_MAX, type TelegramAccountStatus } from '@oppenheimer/shared';

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

  /** Connect again with a token: the host checks it and reports back. The label stays unless given. */
  reconnect(label?: string): void {
    if (label?.trim()) this.props.label = label.trim();
    this.props.status = 'connecting';
    this.props.statusReason = null;
    this.validate();
    this.setUpdatedAt(new Date());
  }

  /**
   * The host's report replaces what was known. The bot's id, username and
   * name are kept once learned, so a report that does not repeat them does
   * not forget them.
   */
  report(report: TelegramBotReport): void {
    this.props.status = report.state;
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
