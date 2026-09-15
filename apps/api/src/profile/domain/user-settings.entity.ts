import {
  AggregateRoot,
  ArgumentInvalidException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';
import {
  DEFAULT_USER_SETTINGS,
  LOCALES,
  type Locale,
  TABLE_DENSITIES,
  type TableDensity,
  THEMES,
  type Theme,
} from '@oppenheimer/shared';

export interface UserSettingsProps {
  theme: Theme;
  locale: Locale;
  density: TableDensity;
  weeklyDigest: boolean;
  productUpdates: boolean;
}

/**
 * A user's workspace preferences. The aggregate is keyed by the user's own id
 * — there is exactly one settings record per user, so it needs no identity of
 * its own, and a caller can always address it without a lookup.
 *
 * Values are validated here rather than trusted from the row: the columns are
 * plain `varchar` (Postgres enums make every new option a migration), so the
 * aggregate is the only thing standing between a hand-edited row and a client
 * that branches on the value.
 */
export class UserSettingsEntity extends AggregateRoot<UserSettingsProps> {
  static create(create: CreateEntityProps<UserSettingsProps>): UserSettingsEntity {
    return new UserSettingsEntity(create);
  }

  /**
   * The preferences a user has before they ever save any. Returned by the read
   * side when no row exists, so an account that has never opened the settings
   * pane answers exactly like one that saved the defaults.
   */
  static createDefault(userId: string): UserSettingsEntity {
    return new UserSettingsEntity({
      id: userId,
      props: { ...DEFAULT_USER_SETTINGS },
    });
  }

  get userId(): string {
    return this.id;
  }

  get theme(): Theme {
    return this.props.theme;
  }

  get locale(): Locale {
    return this.props.locale;
  }

  get density(): TableDensity {
    return this.props.density;
  }

  get weeklyDigest(): boolean {
    return this.props.weeklyDigest;
  }

  get productUpdates(): boolean {
    return this.props.productUpdates;
  }

  /**
   * Replace every preference at once. The settings pane always holds the full
   * set, and a wholesale replace means a client cannot half-apply a form it
   * rendered from a now-stale read.
   */
  update(props: UserSettingsProps): void {
    this.props.theme = props.theme;
    this.props.locale = props.locale;
    this.props.density = props.density;
    this.props.weeklyDigest = props.weeklyDigest;
    this.props.productUpdates = props.productUpdates;
    this.setUpdatedAt(new Date());
    this.validate();
  }

  public validate(): void {
    if (!THEMES.includes(this.props.theme)) {
      throw new ArgumentInvalidException(`Unknown theme: ${this.props.theme}`);
    }
    if (!LOCALES.includes(this.props.locale)) {
      throw new ArgumentInvalidException(`Unknown locale: ${this.props.locale}`);
    }
    if (!TABLE_DENSITIES.includes(this.props.density)) {
      throw new ArgumentInvalidException(`Unknown table density: ${this.props.density}`);
    }
  }
}
