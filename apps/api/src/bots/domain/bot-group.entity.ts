import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import { BOT_GROUP_NAME_MAX } from '@oppenheimer/shared';
import type { Placement } from './bot.types';

export interface BotGroupProps {
  organizationId: string;
  name: string;
  /** Its order in the sidebar, from 0. */
  position: number;
}

/**
 * A heading in the Employees sidebar. It only orders and labels: deleting one
 * leaves its bots, ungrouped.
 */
export class BotGroupEntity extends AggregateRoot<BotGroupProps> {
  private pendingPlacement: Placement | null = null;

  static create(create: CreateEntityProps<BotGroupProps>): BotGroupEntity {
    return new BotGroupEntity(create);
  }

  /** A new group goes last. */
  static createNew(props: { organizationId: string; name: string }): BotGroupEntity {
    const group = new BotGroupEntity({
      id: randomUUID(),
      props: { organizationId: props.organizationId, name: props.name.trim(), position: 0 },
    });
    group.pendingPlacement = 'last';
    group.validate();
    return group;
  }

  get organizationId(): string {
    return this.props.organizationId;
  }
  get name(): string {
    return this.props.name;
  }
  get position(): number {
    return this.props.position;
  }
  get placement(): Placement | null {
    return this.pendingPlacement;
  }

  rename(name: string): void {
    this.props.name = name.trim();
    this.setUpdatedAt(new Date());
    this.validate();
  }

  moveTo(at: Placement): void {
    this.pendingPlacement = at;
  }

  placed(position: number): void {
    this.props.position = position;
    this.pendingPlacement = null;
  }

  public validate(): void {
    if (!this.props.organizationId) {
      throw new ArgumentNotProvidedException('A bot group belongs to an organization');
    }
    if (!this.props.name || this.props.name.length > BOT_GROUP_NAME_MAX) {
      throw new ArgumentInvalidException(`A group's name is 1 to ${BOT_GROUP_NAME_MAX} characters`);
    }
  }
}
