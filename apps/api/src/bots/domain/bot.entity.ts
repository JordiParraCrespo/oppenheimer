import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  BOT_AVATAR_COLORS,
  BOT_DESCRIPTION_MAX,
  BOT_NAME_MAX,
  BOT_PERMISSIONS,
  type BotAvatarColor,
  type BotPermission,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { Placement } from './bot.types';
import { botEffortFor, isBotModel } from './bot-launch.policy';

export interface BotProps {
  organizationId: string;
  /** Who made it; null once that account is gone. The bot is the workspace's, not theirs. */
  createdByUserId: string | null;
  name: string;
  description: string;
  avatarColor: BotAvatarColor;
  /** The sidebar group it sits in; null is ungrouped. */
  groupId: string | null;
  /** Its order inside its group, from 0. */
  position: number;
  /** The host its turns run on; null until one is chosen, or once it is removed. */
  homeHostId: string | null;
  /** A Claude Code model id; null runs Claude Code's default. */
  model: string | null;
  effort: SessionEffort | null;
  permission: BotPermission;
  /** Whether what it decides to remember is saved without asking (slice 3). */
  learnAutomatically: boolean;
}

export interface CreateBotProps {
  organizationId: string;
  createdByUserId: string;
  name: string;
  description: string;
  avatarColor: BotAvatarColor;
  groupId: string | null;
  homeHostId: string | null;
}

export interface BotEdit {
  name?: string;
  description?: string;
  avatarColor?: BotAvatarColor;
  homeHostId?: string | null;
  model?: string | null;
  effort?: SessionEffort | null;
  permission?: BotPermission;
  learnAutomatically?: boolean;
}

/**
 * A bot (`product/versions/mvp/25-bots.md` §1): who it is, where it sits in the
 * sidebar, where it runs and how it is started. Its documents and its memory
 * are aggregates of their own, so editing what it remembers never rewrites
 * who it is.
 */
export class BotEntity extends AggregateRoot<BotProps> {
  private pendingPlacement: Placement | null = null;

  static create(create: CreateEntityProps<BotProps>): BotEntity {
    return new BotEntity(create);
  }

  /** A blank bot: Claude Code's default model, approve-for-me, learning on. Placed last in its group. */
  static createNew(props: CreateBotProps): BotEntity {
    const bot = new BotEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        createdByUserId: props.createdByUserId,
        name: props.name.trim(),
        description: props.description.trim(),
        avatarColor: props.avatarColor,
        groupId: props.groupId,
        position: 0,
        homeHostId: props.homeHostId,
        model: null,
        effort: null,
        permission: 'auto',
        learnAutomatically: true,
      },
    });
    bot.pendingPlacement = 'last';
    bot.validate();
    return bot;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get createdByUserId(): string | null {
    return this.props.createdByUserId;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get avatarColor(): BotAvatarColor {
    return this.props.avatarColor;
  }
  get groupId(): string | null {
    return this.props.groupId;
  }
  get position(): number {
    return this.props.position;
  }
  get homeHostId(): string | null {
    return this.props.homeHostId;
  }
  get model(): string | null {
    return this.props.model;
  }
  get effort(): SessionEffort | null {
    return this.props.effort;
  }
  get permission(): BotPermission {
    return this.props.permission;
  }
  get learnAutomatically(): boolean {
    return this.props.learnAutomatically;
  }

  /** Where the next write puts it among its group's bots, when it moved; null when it did not. */
  get placement(): Placement | null {
    return this.pendingPlacement;
  }

  edit(changes: BotEdit): void {
    const { props } = this;
    if (changes.name !== undefined) props.name = changes.name.trim();
    if (changes.description !== undefined) props.description = changes.description.trim();
    if (changes.avatarColor !== undefined) props.avatarColor = changes.avatarColor;
    if (changes.homeHostId !== undefined) props.homeHostId = changes.homeHostId;
    if (changes.permission !== undefined) props.permission = changes.permission;
    if (changes.learnAutomatically !== undefined) {
      props.learnAutomatically = changes.learnAutomatically;
    }
    if (changes.model !== undefined) props.model = changes.model;
    // An effort the (new) model does not offer is recorded as none: the CLI's default runs.
    const effort = changes.effort !== undefined ? changes.effort : props.effort;
    props.effort = botEffortFor(props.model, effort);
    this.setUpdatedAt(new Date());
    this.validate();
  }

  /**
   * Put it in `groupId` (null: ungrouped) at `at`. Moving to another group with
   * no index puts it last there; the repository closes up both groups' order.
   */
  moveTo(groupId: string | null, at: Placement | undefined): void {
    const changedGroup = groupId !== this.props.groupId;
    if (!changedGroup && at === undefined) return;
    this.props.groupId = groupId;
    this.pendingPlacement = at ?? 'last';
  }

  /** The write landed; the order it asked for is the stored one. */
  placed(position: number): void {
    this.props.position = position;
    this.pendingPlacement = null;
  }

  public validate(): void {
    const { props } = this;
    if (!props.organizationId) {
      throw new ArgumentNotProvidedException('A bot belongs to an organization');
    }
    if (!props.name || props.name.length > BOT_NAME_MAX) {
      throw new ArgumentInvalidException(`A bot's name is 1 to ${BOT_NAME_MAX} characters`);
    }
    if (props.description.length > BOT_DESCRIPTION_MAX) {
      throw new ArgumentInvalidException(
        `A bot's description is at most ${BOT_DESCRIPTION_MAX} characters`,
      );
    }
    if (!BOT_AVATAR_COLORS.includes(props.avatarColor)) {
      throw new ArgumentInvalidException(`${props.avatarColor} is not an avatar colour`);
    }
    if (!BOT_PERMISSIONS.includes(props.permission)) {
      throw new ArgumentInvalidException(`${props.permission} is not a bot's approval level`);
    }
    if (!isBotModel(props.model)) {
      throw new ArgumentInvalidException(`${props.model} is not a Claude Code model`);
    }
    if (!Number.isInteger(props.position) || props.position < 0) {
      throw new ArgumentInvalidException('A position is a whole number from 0');
    }
  }
}
