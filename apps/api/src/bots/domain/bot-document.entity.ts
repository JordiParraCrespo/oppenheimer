import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_DOCUMENT_MAX,
  BOT_DOCUMENT_NAMES,
  BOT_REVISION_NOTE_MAX,
  type BotAuthor,
  type BotDocumentName,
} from '@oppenheimer/shared';
import { authorOf, type BotActor, type BotDocumentRevision } from './bot.types';

export interface BotDocumentProps {
  organizationId: string;
  botId: string;
  name: BotDocumentName;
  content: string;
  /** 1 when the bot is created; one more on every saved change. */
  revision: number;
  updatedBy: BotAuthor;
  updatedByUserId: string | null;
}

/** What a write asks the document to become. */
export interface BotDocumentWrite {
  content: string;
  /** The revision the writer read. */
  baseRevision: number;
  actor: BotActor;
  note?: string;
}

/**
 * `stale`: the writer read an older revision, and nothing changed.
 * `unchanged`: the content is what is already stored, so no revision is made.
 */
export type BotDocumentWriteOutcome = 'written' | 'stale' | 'unchanged';

export function isBotDocumentName(name: string): name is BotDocumentName {
  return (BOT_DOCUMENT_NAMES as readonly string[]).includes(name);
}

/**
 * One of a bot's two documents, `SOUL.md` or `INSTRUCTIONS.md`, with its
 * history. Every change that lands is a new revision, and the history is
 * append-only: a revert writes the old content as the next revision, so
 * nothing a person once saved is lost by going back.
 */
export class BotDocumentEntity extends AggregateRoot<BotDocumentProps> {
  /** The revision the row held when this was read; 0 for one not stored yet. */
  private revisionAtLoad = 0;
  private pending: BotDocumentRevision | null = null;

  static create(create: CreateEntityProps<BotDocumentProps>): BotDocumentEntity {
    const document = new BotDocumentEntity(create);
    document.revisionAtLoad = create.props.revision;
    return document;
  }

  /** A new bot's document at revision 1, which the history reads as "Created". */
  static initial(props: {
    organizationId: string;
    botId: string;
    name: BotDocumentName;
    content: string;
    actor: BotActor;
  }): BotDocumentEntity {
    const { author, authorUserId } = authorOf(props.actor);
    const document = new BotDocumentEntity({
      id: `${props.botId}:${props.name}`,
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        name: props.name,
        content: props.content,
        revision: 1,
        updatedBy: author,
        updatedByUserId: authorUserId,
      },
    });
    document.validate();
    document.pending = document.revisionRecord('', null);
    return document;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get name(): BotDocumentName {
    return this.props.name;
  }
  get content(): string {
    return this.props.content;
  }
  get revision(): number {
    return this.props.revision;
  }
  get updatedBy(): BotAuthor {
    return this.props.updatedBy;
  }
  get updatedByUserId(): string | null {
    return this.props.updatedByUserId;
  }
  /** The revision the stored row must still hold for the next write to land. */
  get expectedRevision(): number {
    return this.revisionAtLoad;
  }
  /** The revision the next write appends, if there is one. */
  get pendingRevision(): BotDocumentRevision | null {
    return this.pending;
  }

  write(change: BotDocumentWrite): BotDocumentWriteOutcome {
    if (change.baseRevision !== this.props.revision) return 'stale';
    if (change.content === this.props.content) return 'unchanged';
    this.apply(change.content, change.actor, change.note?.trim() ?? '', null);
    return 'written';
  }

  /** Make `target`'s content current again, as a new revision. */
  revertTo(target: BotDocumentRevision, actor: BotActor): 'written' | 'unchanged' {
    if (target.botId !== this.props.botId || target.name !== this.props.name) {
      throw new ArgumentInvalidException('A revert restores a revision of the same document');
    }
    if (target.content === this.props.content) return 'unchanged';
    this.apply(target.content, actor, '', target.revision);
    return 'written';
  }

  /** The write landed: the stored row is now at this revision. */
  written(): void {
    this.revisionAtLoad = this.props.revision;
    this.pending = null;
  }

  private apply(content: string, actor: BotActor, note: string, revertedFrom: number | null): void {
    const { author, authorUserId } = authorOf(actor);
    this.props.content = content;
    this.props.revision += 1;
    this.props.updatedBy = author;
    this.props.updatedByUserId = authorUserId;
    this.setUpdatedAt(new Date());
    this.validate();
    this.pending = this.revisionRecord(note, revertedFrom);
  }

  private revisionRecord(note: string, revertedFrom: number | null): BotDocumentRevision {
    if (note.length > BOT_REVISION_NOTE_MAX) {
      throw new ArgumentInvalidException(
        `A revision note is at most ${BOT_REVISION_NOTE_MAX} characters`,
      );
    }
    return {
      id: randomUUID(),
      organizationId: this.props.organizationId,
      botId: this.props.botId,
      name: this.props.name,
      revision: this.props.revision,
      content: this.props.content,
      author: this.props.updatedBy,
      authorUserId: this.props.updatedByUserId,
      note,
      revertedFrom,
      createdAt: new Date(),
    };
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId || !props.botId) {
      throw new ArgumentNotProvidedException('A document belongs to a bot');
    }
    if (!isBotDocumentName(props.name)) {
      throw new ArgumentInvalidException(`${props.name} is not a bot document`);
    }
    if (props.content.length > BOT_DOCUMENT_MAX) {
      throw new ArgumentInvalidException(`A document is at most ${BOT_DOCUMENT_MAX} characters`);
    }
    if (!Number.isInteger(props.revision) || props.revision < 1) {
      throw new ArgumentInvalidException('A revision is a whole number from 1');
    }
  }
}
