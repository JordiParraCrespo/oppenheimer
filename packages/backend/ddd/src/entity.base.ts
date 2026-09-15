import {
  ArgumentInvalidException,
  ArgumentNotProvidedException,
  ArgumentOutOfRangeException,
} from './exceptions';
import { Guard } from './guard';
import { convertPropsToObject } from './utils';

export type AggregateID = string;

export interface BaseEntityProps {
  id: AggregateID;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEntityProps<T> {
  id: AggregateID;
  props: T;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Base class for domain entities. Entities have an identity and protect their
 * own invariants through `validate()`. They contain no persistence or
 * framework concerns.
 */
export abstract class Entity<EntityProps> {
  protected readonly props: EntityProps;

  // Concrete (not a subclass field) so it is set once in the constructor and
  // never reset by a subclass field initializer under `useDefineForClassFields`.
  protected _id!: AggregateID;

  private readonly _createdAt: Date;

  private _updatedAt: Date;

  constructor({ id, createdAt, updatedAt, props }: CreateEntityProps<EntityProps>) {
    this.setId(id);
    this.validateProps(props);
    const now = new Date();
    this._createdAt = createdAt ?? now;
    this._updatedAt = updatedAt ?? now;
    this.props = props;
    this.validate();
  }

  get id(): AggregateID {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  protected setUpdatedAt(date: Date): void {
    this._updatedAt = date;
  }

  static isEntity(entity: unknown): entity is Entity<unknown> {
    return entity instanceof Entity;
  }

  public equals(object?: Entity<EntityProps>): boolean {
    if (object === null || object === undefined) {
      return false;
    }
    if (this === object) {
      return true;
    }
    if (!Entity.isEntity(object)) {
      return false;
    }
    return this.id ? this.id === object.id : false;
  }

  /** Returns a frozen copy of the entity props plus base props. */
  public getProps(): EntityProps & BaseEntityProps {
    const propsCopy = {
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      ...this.props,
    };
    return Object.freeze(propsCopy);
  }

  /** Returns a plain, frozen object with nested value objects unpacked. */
  public toObject(): unknown {
    const plainProps = convertPropsToObject(this.props);
    const result = {
      id: this._id,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
      ...(plainProps as object),
    };
    return Object.freeze(result);
  }

  /** Invariant validation. Called on construction and after mutations. */
  public abstract validate(): void;

  private setId(id: AggregateID): void {
    this._id = id;
  }

  private validateProps(props: EntityProps): void {
    const MAX_PROPS = 50;

    if (Guard.isEmpty(props)) {
      throw new ArgumentNotProvidedException('Entity props should not be empty');
    }
    if (typeof props !== 'object') {
      throw new ArgumentInvalidException('Entity props should be an object');
    }
    if (Object.keys(props as object).length > MAX_PROPS) {
      throw new ArgumentOutOfRangeException(
        `Entity props should not have more than ${MAX_PROPS} properties`,
      );
    }
  }
}
