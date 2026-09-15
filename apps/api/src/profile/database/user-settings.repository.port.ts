import type { RepositoryPort } from '@oppenheimer/backend-ddd';
import type { UserSettingsEntity } from '../domain/user-settings.entity';

/**
 * Port for a user's preferences. Implemented by the TypeORM adapter in
 * `user-settings.repository.ts`.
 *
 * The base port's `save` is enough: the aggregate is keyed by the user id, so a
 * save is an upsert whether or not a row exists yet, and the command handler
 * never has to know which case it is in.
 */
export type UserSettingsRepositoryPort = RepositoryPort<UserSettingsEntity>;
