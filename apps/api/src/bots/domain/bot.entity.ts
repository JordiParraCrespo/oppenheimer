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
  BOT_PROVIDERS,
  BOT_SECTIONS,
  type BotAvatarColor,
  type BotPermission,
  type BotProvider,
  type BotSection,
  botModelOf,
} from '@oppenheimer/shared';
import type { SessionEffort } from '@oppenheimer/shared/agents';
import type { Placement } from './bot.types';
import { BOT_DEFAULT_PERMISSION } from './bot-creation.policy';
import { resolveBotEngine } from './bot-launch.policy';

export interface BotProps {
  organizationId: string;
  /** Who made it; null once that account is gone. The bot is the workspace's, not theirs. */
  createdByUserId: string | null;
  /** The bot that made it through `create_bot`; null when made in the console, or once that bot is deleted. */
  createdByBotId?: string | null;
  /** What makes its creation happen once: the tool call's key; null for the console's. */
  idempotencyKey?: string | null;
  name: string;
  description: string;
  avatarColor: BotAvatarColor;
  /** The sidebar group it sits in; null is ungrouped. */
  groupId: string | null;
  /** Its order inside its group, from 0. */
  position: number;
  /** The host its turns run on; null until one is chosen, or once it is removed. */
  homeHostId: string | null;
  /** Who answers it, and so which engine runs its turns. */
  provider: BotProvider;
  /** A model id the provider offers; null runs the provider's default. */
  model: string | null;
  effort: SessionEffort | null;
  permission: BotPermission;
  /** Whether what it decides to remember is saved without asking (slice 3). */
  learnAutomatically: boolean;
  /** The console sections it shows in beside Employees, each once; none when absent. */
  sections?: readonly BotSection[];
  /** When its chat last had a message, and the start of it; written by the chat, never an edit. */
  lastMessageAt?: Date | null;
  lastMessagePreview?: string | null;
}

export interface CreateBotProps {
  organizationId: string;
  createdByUserId: string;
  name: string;
  description: string;
  avatarColor: BotAvatarColor;
  groupId: string | null;
  homeHostId: string | null;
  provider: BotProvider;
  /** A model id the provider offers; null or absent is the provider's default. */
  model?: string | null;
  /** Kept only when the model offers it. */
  effort?: SessionEffort | null;
  /** Approve for me unless named. */
  permission?: BotPermission;
  /** The bot that is creating it, and the key that makes that creation happen once. */
  createdByBotId?: string | null;
  idempotencyKey?: string | null;
  /** None unless named. */
  sections?: readonly BotSection[];
}

export interface BotEdit {
  name?: string;
  description?: string;
  avatarColor?: BotAvatarColor;
  homeHostId?: string | null;
  provider?: BotProvider;
  model?: string | null;
  effort?: SessionEffort | null;
  permission?: BotPermission;
  learnAutomatically?: boolean;
  sections?: readonly BotSection[];
}

/** A column an edit can set. */
export type BotEditedField =
  | 'name'
  | 'description'
  | 'avatarColor'
  | 'groupId'
  | 'homeHostId'
  | 'provider'
  | 'model'
  | 'effort'
  | 'permission'
  | 'learnAutomatically'
  | 'sections';

/**
 * A bot (`product/versions/mvp/25-bots.md` §1): who it is, where it sits in the
 * sidebar, where it runs and how it is started. Its documents and its memory
 * are aggregates of their own, so editing what it remembers never rewrites
 * who it is.
 */
export class BotEntity extends AggregateRoot<BotProps> {
  private pendingPlacement: Placement | null = null;
  /**
   * The columns an edit set, and only those: two edits made at once from the
   * console (the colour, then the model) each write what they changed, so the
   * later never puts back what the earlier changed from its stale copy. The
   * provider, model and effort are one setting and are written together.
   */
  private readonly edited = new Set<BotEditedField>();

  static create(create: CreateEntityProps<BotProps>): BotEntity {
    return new BotEntity(create);
  }

  /**
   * A blank bot: its provider's default model unless one is named,
   * approve-for-me unless a level is named, learning on. Placed last in its
   * group. A model the provider does not offer is refused.
   */
  static createNew(props: CreateBotProps): BotEntity {
    const engine = resolveBotEngine(
      { provider: props.provider, model: null, effort: null },
      { model: props.model ?? null, effort: props.effort ?? null },
    );
    const bot = new BotEntity({
      id: randomUUID(),
      props: {
        organizationId: props.organizationId,
        createdByUserId: props.createdByUserId,
        createdByBotId: props.createdByBotId ?? null,
        idempotencyKey: props.idempotencyKey ?? null,
        name: props.name.trim(),
        description: props.description.trim(),
        avatarColor: props.avatarColor,
        groupId: props.groupId,
        position: 0,
        homeHostId: props.homeHostId,
        ...engine,
        permission: props.permission ?? BOT_DEFAULT_PERMISSION,
        learnAutomatically: true,
        sections: inSectionOrder(props.sections ?? []),
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
  get createdByBotId(): string | null {
    return this.props.createdByBotId ?? null;
  }
  get idempotencyKey(): string | null {
    return this.props.idempotencyKey ?? null;
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
  get provider(): BotProvider {
    return this.props.provider;
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
  get sections(): readonly BotSection[] {
    return this.props.sections ?? [];
  }

  get lastMessageAt(): Date | null {
    return this.props.lastMessageAt ?? null;
  }

  get lastMessagePreview(): string | null {
    return this.props.lastMessagePreview ?? null;
  }

  /** Where the next write puts it among its group's bots, when it moved; null when it did not. */
  get placement(): Placement | null {
    return this.pendingPlacement;
  }

  edit(changes: BotEdit): void {
    const { props, edited } = this;
    if (changes.name !== undefined) {
      props.name = changes.name.trim();
      edited.add('name');
    }
    if (changes.description !== undefined) {
      props.description = changes.description.trim();
      edited.add('description');
    }
    if (changes.avatarColor !== undefined) {
      props.avatarColor = changes.avatarColor;
      edited.add('avatarColor');
    }
    if (changes.homeHostId !== undefined) {
      props.homeHostId = changes.homeHostId;
      edited.add('homeHostId');
    }
    if (changes.permission !== undefined) {
      props.permission = changes.permission;
      edited.add('permission');
    }
    if (changes.learnAutomatically !== undefined) {
      props.learnAutomatically = changes.learnAutomatically;
      edited.add('learnAutomatically');
    }
    if (changes.sections !== undefined) {
      props.sections = inSectionOrder(changes.sections);
      edited.add('sections');
    }
    if (
      changes.provider !== undefined ||
      changes.model !== undefined ||
      changes.effort !== undefined
    ) {
      // The three are one setting: each is valid only for the others, so they
      // are resolved and written together.
      Object.assign(props, resolveBotEngine(props, changes));
      edited.add('provider').add('model').add('effort');
    }
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
    if (changedGroup) this.edited.add('groupId');
    this.pendingPlacement = at ?? 'last';
  }

  /** The columns this instance's edits set, for the write that stores them. */
  get editedFields(): ReadonlySet<BotEditedField> {
    return this.edited;
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
    if (!BOT_PROVIDERS.includes(props.provider)) {
      throw new ArgumentInvalidException(`${props.provider} is not a bot provider`);
    }
    if (botModelOf(props.provider, props.model) === undefined) {
      throw new ArgumentInvalidException(`${props.model} is not a ${props.provider} model`);
    }
    if (!Number.isInteger(props.position) || props.position < 0) {
      throw new ArgumentInvalidException('A position is a whole number from 0');
    }
  }
}

/**
 * Each section once, in the catalog's order, so a stored set reads the same
 * however it was sent. A section the console does not have is refused, never
 * dropped.
 */
function inSectionOrder(sections: readonly BotSection[]): BotSection[] {
  const unknown = sections.find((section) => !BOT_SECTIONS.includes(section));
  if (unknown !== undefined) {
    throw new ArgumentInvalidException(`${unknown} is not a console section`);
  }
  return BOT_SECTIONS.filter((section) => sections.includes(section));
}
