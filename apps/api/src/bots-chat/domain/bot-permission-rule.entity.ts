import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_PERMISSION_RULE_EFFECTS,
  BOT_PERMISSION_RULE_MAX,
  type BotPermissionRuleEffect,
} from '@oppenheimer/shared';

export interface BotPermissionRuleProps {
  organizationId: string;
  botId: string;
  /** `allow` lets a matching call run without a card; `ask` makes one ask. */
  effect: BotPermissionRuleEffect;
  /** The rule in the owner's words: "Merging is fine in acme/docs". */
  text: string;
  /** Who wrote it; null once that account is gone. */
  createdByUserId: string | null;
}

/**
 * A plain-language rule a reviewer reads before an asking call
 * (`25-bots.md` §5). It decides nothing by itself: the reviewer matches a
 * call against every rule of the bot, and an `ask` rule that matches wins.
 */
export class BotPermissionRuleEntity extends AggregateRoot<BotPermissionRuleProps> {
  static create(create: CreateEntityProps<BotPermissionRuleProps>): BotPermissionRuleEntity {
    return new BotPermissionRuleEntity(create);
  }

  static write(props: {
    organizationId: string;
    botId: string;
    effect: BotPermissionRuleEffect;
    text: string;
    userId: string | null;
  }): BotPermissionRuleEntity {
    const rule = new BotPermissionRuleEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        botId: props.botId,
        effect: props.effect,
        text: props.text.trim().replace(/\s+/g, ' '),
        createdByUserId: props.userId,
      },
    });
    rule.validate();
    return rule;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get botId(): string {
    return this.props.botId;
  }
  get effect(): BotPermissionRuleEffect {
    return this.props.effect;
  }
  get text(): string {
    return this.props.text;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }

  validate(): void {
    const { organizationId, botId, effect, text } = this.props;
    if (!organizationId || !botId) {
      throw new ArgumentNotProvidedException('A rule names its bot');
    }
    if (!BOT_PERMISSION_RULE_EFFECTS.includes(effect)) {
      throw new ArgumentInvalidException(`${effect} is not a rule's effect`);
    }
    if (!text || text.length > BOT_PERMISSION_RULE_MAX) {
      throw new ArgumentInvalidException(
        `A rule is a sentence of 1 to ${BOT_PERMISSION_RULE_MAX} characters`,
      );
    }
  }
}
