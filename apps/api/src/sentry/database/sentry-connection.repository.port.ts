import type { Option } from 'oxide.ts';
import type { SentryConnectionEntity } from '../domain/sentry-connection.entity';

export interface SentryConnectionRepositoryPort {
  /** The workspace's connection, if it has one. */
  findForOrganization(organizationId: string): Promise<Option<SentryConnectionEntity>>;
  /** By id, whatever workspace holds it: the webhook's lookup, before any caller is known. */
  findById(id: string): Promise<Option<SentryConnectionEntity>>;
  /** Stores the connection, replacing the workspace's previous one (`UQ_sentry_connection_organization`). */
  put(connection: SentryConnectionEntity): Promise<SentryConnectionEntity>;
  /** Removes the workspace's connection; false when it had none. */
  deleteForOrganization(organizationId: string): Promise<boolean>;
}
