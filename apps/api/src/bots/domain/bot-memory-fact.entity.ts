import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_MEMORY_FACT_MAX,
  BOT_MEMORY_SCOPES,
  BOT_MEMORY_TIERS,
  type BotAuthor,
  type BotMemoryScope,
  type BotMemoryTier,
} from '@oppenheimer/shared';
import { authorOf, type BotActor } from './bot.types';

export interface BotMemoryFactProps {
  organizationId: string;
  botId: string;
  content: string;
  /** Who wrote it last: a person in Settings, or the bot through `remember` (slice 3). */
  source: BotAuthor;
  /** In mind every turn (`profile`), or looked up with `recall` (`log`). */
  tier: BotMemoryTier;
  /** This bot's alone (`bot`), or read by every bot of its owner (`person`). */
  scope: BotMemoryScope;
}

/** One thing a bot remembers, in a sentence. */
export class BotMemoryFactEntity extends AggregateRoot<BotMemoryFactProps> {
  static create(create: CreateEntityProps<BotMemoryFactProps>): BotMemoryFactEntity {
    return new BotMemoryFactEntity(create);
  }

  static createNew(props: {
    organizationId: string;
    botId: string;
    content: string;
    actor: BotActor;
    tier?: BotMemoryTier;
    scope?: BotMemoryScope;
  }): BotMemoryFactEntity {
    const fact = new BotMemoryFactEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        content: props.content.trim(),
        source: authorOf(props.actor).author,
        tier: props.tier ?? 'profile',
        scope: props.scope ?? 'bot',
      },
    });
    fact.validate();
    return fact;
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
  get source(): BotAuthor {
    return this.props.source;
  }
  get tier(): BotMemoryTier {
    return this.props.tier;
  }
  get scope(): BotMemoryScope {
    return this.props.scope;
  }

  /**
   * Changes its words, its tier or its scope. New words make whoever wrote
   * them its source; moving it between tiers or scopes does not.
   */
  edit(
    change: { content?: string; tier?: BotMemoryTier; scope?: BotMemoryScope },
    actor: BotActor,
  ): void {
    if (change.content !== undefined) {
      this.props.content = change.content.trim();
      this.props.source = authorOf(actor).author;
    }
    if (change.tier) this.props.tier = change.tier;
    if (change.scope) this.props.scope = change.scope;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.organizationId || !this.props.botId) {
      throw new ArgumentNotProvidedException('A memory fact belongs to a bot');
    }
    if (!this.props.content || this.props.content.length > BOT_MEMORY_FACT_MAX) {
      throw new ArgumentInvalidException(`A memory fact is 1 to ${BOT_MEMORY_FACT_MAX} characters`);
    }
    if (
      !BOT_MEMORY_TIERS.includes(this.props.tier) ||
      !BOT_MEMORY_SCOPES.includes(this.props.scope)
    ) {
      throw new ArgumentInvalidException('A memory fact has a known tier and scope');
    }
  }
}
