import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_TOOL_DECISIONS, type BotToolDecision } from '@oppenheimer/shared';

/** The one thing a call acts on, when its tool names one: a repository, a session. */
export interface BotToolSubject {
  /** What it is (`repository`, `session`): grants of one kind never match another. */
  kind: string;
  /** What identifies it, stable across renames (`acme/xrp-mobile`, a session id). */
  key: string;
  /** How the card and Settings name it. */
  label: string;
}

/** How long a subject's parts may be, as the columns hold them. */
const SUBJECT_KIND_MAX = 32;
const SUBJECT_TEXT_MAX = 200;

export interface BotToolPermissionProps {
  organizationId: string;
  botId: string;
  /** The tool, as the bot knows it (`merge_pull_request`). */
  tool: string;
  decision: BotToolDecision;
  /** Null for the tool's own decision; set for a standing grant on one thing, which is always `allow`. */
  subject: BotToolSubject | null;
  /** Who set it; null once that account is gone. */
  createdByUserId: string | null;
}

/**
 * The owner's setting for one of a bot's tools (`25-bots.md` §5), where it
 * differs from the catalog: the tool's decision (Allow, Ask, Off), or a
 * standing grant that lets every call of the tool on one thing run without
 * asking ("Always allow merges in acme/xrp-mobile").
 */
export class BotToolPermissionEntity extends AggregateRoot<BotToolPermissionProps> {
  static create(create: CreateEntityProps<BotToolPermissionProps>): BotToolPermissionEntity {
    return new BotToolPermissionEntity(create);
  }

  /** The tool's own decision, replacing any it had. */
  static decide(props: {
    organizationId: string;
    botId: string;
    tool: string;
    decision: BotToolDecision;
    userId: string | null;
  }): BotToolPermissionEntity {
    return BotToolPermissionEntity.make({ ...props, subject: null });
  }

  /** A standing yes for every call of the tool on `subject`. */
  static grant(props: {
    organizationId: string;
    botId: string;
    tool: string;
    subject: BotToolSubject;
    userId: string | null;
  }): BotToolPermissionEntity {
    return BotToolPermissionEntity.make({ ...props, decision: 'allow' });
  }

  private static make(props: {
    organizationId: string;
    botId: string;
    tool: string;
    decision: BotToolDecision;
    subject: BotToolSubject | null;
    userId: string | null;
  }): BotToolPermissionEntity {
    const permission = new BotToolPermissionEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        tool: props.tool,
        decision: props.decision,
        subject: props.subject,
        createdByUserId: props.userId,
      },
    });
    permission.validate();
    return permission;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get tool(): string {
    return this.props.tool;
  }
  get decision(): BotToolDecision {
    return this.props.decision;
  }
  get subject(): BotToolSubject | null {
    return this.props.subject;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }

  validate(): void {
    const { organizationId, botId, tool, decision, subject } = this.props;
    if (!organizationId || !botId || !tool) {
      throw new ArgumentNotProvidedException('A tool permission names its bot and its tool');
    }
    if (!BOT_TOOL_DECISIONS.includes(decision)) {
      throw new ArgumentInvalidException(`${decision} is not a tool decision`);
    }
    if (!subject) return;
    if (decision !== 'allow') {
      throw new ArgumentInvalidException('A grant for one thing only ever allows');
    }
    if (
      !subject.kind ||
      !subject.key ||
      !subject.label ||
      subject.kind.length > SUBJECT_KIND_MAX ||
      subject.key.length > SUBJECT_TEXT_MAX ||
      subject.label.length > SUBJECT_TEXT_MAX
    ) {
      throw new ArgumentInvalidException('A grant names what it covers, briefly');
    }
  }
}

/** A subject cut to what the columns hold, so a long repository name still makes a grant. */
export function fitSubject(subject: BotToolSubject): BotToolSubject {
  return {
    kind: subject.kind.slice(0, SUBJECT_KIND_MAX),
    key: subject.key.slice(0, SUBJECT_TEXT_MAX),
    label: subject.label.slice(0, SUBJECT_TEXT_MAX),
  };
}
