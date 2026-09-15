import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';
import type { Locale, TableDensity, Theme } from '@oppenheimer/shared';

/**
 * Replaces every preference at once — there is no partial variant on purpose,
 * so a client can never save a form it rendered from a read that has since gone
 * stale and silently revert someone else's change to a field it did not show.
 */
export class UpdateUserSettingsCommand extends CommandBase {
  readonly userId: string;
  readonly theme: Theme;
  readonly locale: Locale;
  readonly density: TableDensity;
  readonly weeklyDigest: boolean;
  readonly productUpdates: boolean;

  constructor(props: CommandProps<UpdateUserSettingsCommand>) {
    super(props);
    this.userId = props.userId;
    this.theme = props.theme;
    this.locale = props.locale;
    this.density = props.density;
    this.weeklyDigest = props.weeklyDigest;
    this.productUpdates = props.productUpdates;
  }
}
