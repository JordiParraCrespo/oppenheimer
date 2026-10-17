import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_SUMMARY_MAX, summaryContent } from './bot-summary.policy';

export interface BotConversationSummaryProps {
  organizationId: string;
  botId: string;
  /** What the conversation said and decided up to the cutoff, in the summarizer's words. */
  content: string;
  /** The newest message the summary covers; a turn's history starts after it. */
  coversThroughMessageId: string;
  /** That message's time, as stored; the database sets it from the message on each write. */
  coversThroughCreatedAt: Date;
  /** How many writes the row has had; 0 for a summary not stored yet. */
  version: number;
}

/** The message a summary covers through: its id and when it was stored. */
export interface SummaryCutoff {
  id: string;
  createdAt: Date;
}

/**
 * A bot's conversation summary (`25-bots.md` §2): one per bot, what its
 * oldest messages said, sent as the first entry of a turn's history in their
 * place. Its id is the bot's. Each write is conditioned on the version it was
 * loaded at and only moves the cutoff forward, so two summarizing jobs that
 * race never leave it older than either one made it.
 */
export class BotConversationSummaryEntity extends AggregateRoot<BotConversationSummaryProps> {
  private loadedVersion: number;

  constructor(create: CreateEntityProps<BotConversationSummaryProps>) {
    super(create);
    this.loadedVersion = create.props.version;
  }

  static create(
    create: CreateEntityProps<BotConversationSummaryProps>,
  ): BotConversationSummaryEntity {
    return new BotConversationSummaryEntity(create);
  }

  /** A bot's first summary, through `through`. */
  static first(props: {
    organizationId: string;
    botId: string;
    content: string;
    through: SummaryCutoff;
  }): BotConversationSummaryEntity {
    const summary = new BotConversationSummaryEntity({
      id: props.botId,
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        content: summaryContent(props.content),
        coversThroughMessageId: props.through.id,
        coversThroughCreatedAt: props.through.createdAt,
        version: 0,
      },
    });
    summary.validate();
    return summary;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get content(): string {
    return this.props.content;
  }
  get coversThroughMessageId(): string {
    return this.props.coversThroughMessageId;
  }
  get coversThroughCreatedAt(): Date {
    return this.props.coversThroughCreatedAt;
  }
  /** The version its next write is conditioned on; 0 means it is not stored yet. */
  get versionAtLoad(): number {
    return this.loadedVersion;
  }

  /** The summary rewritten to cover through a later message. It never moves back. */
  revise(content: string, through: SummaryCutoff): void {
    if (through.createdAt.getTime() < this.props.coversThroughCreatedAt.getTime()) {
      throw new ArgumentInvalidException('A summary only moves forward');
    }
    this.props.content = summaryContent(content);
    this.props.coversThroughMessageId = through.id;
    this.props.coversThroughCreatedAt = through.createdAt;
    this.validate();
  }

  /** The write that stored this instance landed: its next one is conditioned on that. */
  markPersisted(): void {
    this.loadedVersion += 1;
    this.props.version = this.loadedVersion;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId) {
      throw new ArgumentNotProvidedException('A summary belongs to a bot');
    }
    if (!props.coversThroughMessageId) {
      throw new ArgumentNotProvidedException('A summary covers through a message');
    }
    if (!props.content || props.content.length > BOT_SUMMARY_MAX) {
      throw new ArgumentInvalidException(`A summary holds 1 to ${BOT_SUMMARY_MAX} characters`);
    }
    if (props.version < 0) throw new ArgumentInvalidException('A version is never negative');
  }
}
