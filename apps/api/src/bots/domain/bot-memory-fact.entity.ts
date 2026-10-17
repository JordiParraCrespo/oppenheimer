import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_MEMORY_FACT_MAX, type BotAuthor } from '@oppenheimer/shared';
import { authorOf, type BotActor } from './bot.types';

export interface BotMemoryFactProps {
  organizationId: string;
  botId: string;
  content: string;
  /** Who wrote it last: a person in Settings, or the bot through `remember` (slice 3). */
  source: BotAuthor;
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
  }): BotMemoryFactEntity {
    const fact = new BotMemoryFactEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        content: props.content.trim(),
        source: authorOf(props.actor).author,
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

  edit(content: string, actor: BotActor): void {
    this.props.content = content.trim();
    this.props.source = authorOf(actor).author;
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
  }
}
