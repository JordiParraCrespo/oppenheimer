import { CommandBase, type CommandProps } from '@oppenheimer/backend-ddd';

/**
 * An account's standing changed outside the application: banned or unbanned
 * straight through Better Auth's admin plugin (`/api/auth/admin/ban-user`,
 * `/unban-user`) rather than through the admin module. Whatever delegated
 * sessions its credentials had cached point at session rows the ban deleted,
 * so they are moved onto fresh keys. The admin module's own ban and unban
 * rotate them themselves; the after-hook raises this for both paths.
 */
export class RotateDelegatedSessionsCommand extends CommandBase {
  readonly userId: string;

  constructor(props: CommandProps<RotateDelegatedSessionsCommand>) {
    super(props);
    this.userId = props.userId;
  }
}
