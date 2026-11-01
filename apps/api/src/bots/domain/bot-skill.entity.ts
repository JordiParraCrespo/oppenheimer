import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_SKILL_BODY_MAX,
  BOT_SKILL_DESCRIPTION_MAX,
  BOT_SKILL_NAME_PATTERN,
  BOT_SKILL_RESERVED_NAMES,
  type BotAuthor,
} from '@oppenheimer/shared';
import { authorOf, type BotActor } from './bot.types';

export interface BotSkillProps {
  organizationId: string;
  botId: string;
  /** Lowercase, digits and hyphens: what the person types after `/`. */
  name: string;
  /** When to reach for it, as every turn's prompt lists it. */
  description: string;
  /** The skill itself: the steps, the checks, what to report. */
  body: string;
  /** The person may run it as `/<name>`. */
  userInvocable: boolean;
  /** The prompt lists it, so the bot may use it unasked. */
  modelInvocable: boolean;
  /** Who wrote it last: a person in Settings, or the bot through `save_skill`. */
  source: BotAuthor;
}

export type BotSkillChange = Partial<
  Pick<BotSkillProps, 'name' | 'description' | 'body' | 'userInvocable' | 'modelInvocable'>
>;

/**
 * A reusable way of doing one task, saved under a name (OpenClaw's skills,
 * Grok Bot's saved skills). A skill nobody may invoke, the person or the bot,
 * would be dead weight in every prompt, so at least one of the two is on.
 */
export class BotSkillEntity extends AggregateRoot<BotSkillProps> {
  static create(create: CreateEntityProps<BotSkillProps>): BotSkillEntity {
    return new BotSkillEntity(create);
  }

  static createNew(props: {
    organizationId: string;
    botId: string;
    name: string;
    description: string;
    body: string;
    userInvocable?: boolean;
    modelInvocable?: boolean;
    actor: BotActor;
  }): BotSkillEntity {
    const skill = new BotSkillEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        name: props.name.trim(),
        description: props.description.trim(),
        body: props.body.trim(),
        userInvocable: props.userInvocable ?? true,
        modelInvocable: props.modelInvocable ?? true,
        source: authorOf(props.actor).author,
      },
    });
    skill.validate();
    return skill;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get body(): string {
    return this.props.body;
  }
  get userInvocable(): boolean {
    return this.props.userInvocable;
  }
  get modelInvocable(): boolean {
    return this.props.modelInvocable;
  }
  get source(): BotAuthor {
    return this.props.source;
  }

  /** Changes any of its parts; whoever changed its words becomes its source. */
  edit(change: BotSkillChange, actor: BotActor): void {
    if (change.name !== undefined) this.props.name = change.name.trim();
    if (change.description !== undefined) this.props.description = change.description.trim();
    if (change.body !== undefined) this.props.body = change.body.trim();
    if (change.userInvocable !== undefined) this.props.userInvocable = change.userInvocable;
    if (change.modelInvocable !== undefined) this.props.modelInvocable = change.modelInvocable;
    if (
      change.name !== undefined ||
      change.description !== undefined ||
      change.body !== undefined
    ) {
      this.props.source = authorOf(actor).author;
    }
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!this.props.organizationId || !this.props.botId) {
      throw new ArgumentNotProvidedException('A skill belongs to a bot');
    }
    if (
      !BOT_SKILL_NAME_PATTERN.test(this.props.name) ||
      (BOT_SKILL_RESERVED_NAMES as readonly string[]).includes(this.props.name)
    ) {
      throw new ArgumentInvalidException(
        'A skill is named in lowercase letters, digits and hyphens, at most 32, and not "skill"',
      );
    }
    if (!this.props.description || this.props.description.length > BOT_SKILL_DESCRIPTION_MAX) {
      throw new ArgumentInvalidException(
        `A skill's description is 1 to ${BOT_SKILL_DESCRIPTION_MAX} characters`,
      );
    }
    if (!this.props.body || this.props.body.length > BOT_SKILL_BODY_MAX) {
      throw new ArgumentInvalidException(`A skill is 1 to ${BOT_SKILL_BODY_MAX} characters`);
    }
    if (!this.props.userInvocable && !this.props.modelInvocable) {
      throw new ArgumentInvalidException(
        'A skill is run by the person, by the bot, or both: turn one of them on',
      );
    }
  }
}
