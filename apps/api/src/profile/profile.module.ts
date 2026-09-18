import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../auth/database/session.orm-entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';
import { UsersModule } from '../users/user.module';
import { LocaleResolver } from './application/locale.resolver';
import { ChangePasswordCommandHandler } from './commands/change-password/change-password.command-handler';
import { ChangePasswordHttpController } from './commands/change-password/change-password.http.controller';
import { DeleteAvatarCommandHandler } from './commands/delete-avatar/delete-avatar.command-handler';
import { DeleteAvatarHttpController } from './commands/delete-avatar/delete-avatar.http.controller';
import { RevokeOtherSessionsCommandHandler } from './commands/revoke-other-sessions/revoke-other-sessions.command-handler';
import { RevokeOtherSessionsHttpController } from './commands/revoke-other-sessions/revoke-other-sessions.http.controller';
import { RevokeSessionCommandHandler } from './commands/revoke-session/revoke-session.command-handler';
import { RevokeSessionHttpController } from './commands/revoke-session/revoke-session.http.controller';
import { UpdateProfileCommandHandler } from './commands/update-profile/update-profile.command-handler';
import { UpdateProfileHttpController } from './commands/update-profile/update-profile.http.controller';
import { UpdateUserSettingsCommandHandler } from './commands/update-user-settings/update-user-settings.command-handler';
import { UpdateUserSettingsHttpController } from './commands/update-user-settings/update-user-settings.http.controller';
import { UploadAvatarCommandHandler } from './commands/upload-avatar/upload-avatar.command-handler';
import { UploadAvatarHttpController } from './commands/upload-avatar/upload-avatar.http.controller';
import { SessionRepository } from './database/session.repository';
import { UserSettingsOrmEntity } from './database/user-settings.orm-entity';
import { UserSettingsRepository } from './database/user-settings.repository';
import { AvatarStorageAdapter } from './infrastructure/avatar-storage.adapter';
import { ProfileAuthGateway } from './infrastructure/profile-auth.gateway';
import {
  AVATAR_STORAGE,
  LOCALE_RESOLVER,
  PROFILE_AUTH,
  SESSION_READER,
  USER_SETTINGS_REPOSITORY,
} from './profile.di-tokens';
import { ProfileMapper } from './profile.mapper';
import { FindSessionsHttpController } from './queries/find-sessions/find-sessions.http.controller';
import { FindSessionsQueryHandler } from './queries/find-sessions/find-sessions.query-handler';
import { GetProfileHttpController } from './queries/get-profile/get-profile.http.controller';
import { GetProfileQueryHandler } from './queries/get-profile/get-profile.query-handler';
import { GetUserSettingsHttpController } from './queries/get-user-settings/get-user-settings.http.controller';
import { GetUserSettingsQueryHandler } from './queries/get-user-settings/get-user-settings.query-handler';

// Registration order matters: every static sub-route (`settings`, `avatar`,
// `sessions`) must be matched before `sessions/:id`, and the bare `GET`/`PATCH`
// on the collection last.
const httpControllers = [
  GetUserSettingsHttpController,
  UpdateUserSettingsHttpController,
  UploadAvatarHttpController,
  DeleteAvatarHttpController,
  FindSessionsHttpController,
  RevokeOtherSessionsHttpController,
  RevokeSessionHttpController,
  ChangePasswordHttpController,
  GetProfileHttpController,
  UpdateProfileHttpController,
];

const commandHandlers: Provider[] = [
  UpdateProfileCommandHandler,
  UpdateUserSettingsCommandHandler,
  UploadAvatarCommandHandler,
  DeleteAvatarCommandHandler,
  ChangePasswordCommandHandler,
  RevokeSessionCommandHandler,
  RevokeOtherSessionsCommandHandler,
];

const queryHandlers: Provider[] = [
  GetProfileQueryHandler,
  GetUserSettingsQueryHandler,
  FindSessionsQueryHandler,
];

const repositories: Provider[] = [
  { provide: USER_SETTINGS_REPOSITORY, useClass: UserSettingsRepository },
  { provide: SESSION_READER, useClass: SessionRepository },
];

// Every outbound dependency is bound to the token its port is named by, so a
// handler names the port and the choice of adapter is made once, here.
const adapters: Provider[] = [
  { provide: AVATAR_STORAGE, useClass: AvatarStorageAdapter },
  { provide: PROFILE_AUTH, useClass: ProfileAuthGateway },
  { provide: LOCALE_RESOLVER, useClass: LocaleResolver },
];

/**
 * The caller's own account: profile fields, preferences, password and sessions.
 *
 * Imports `UsersModule` for its `USER_REPOSITORY` — the `user` row is that
 * module's aggregate, and this module reads and updates the profile columns on
 * it through that port rather than mapping the same table twice.
 */
@Module({
  imports: [
    CqrsModule,
    UsersModule,
    TypeOrmModule.forFeature([UserSettingsOrmEntity, Session, UserOrmEntity]),
  ],
  controllers: [...httpControllers],
  providers: [...commandHandlers, ...queryHandlers, ...repositories, ...adapters, ProfileMapper],
  // `LOCALE_RESOLVER` is what the email worker reads a recipient's language
  // through — the settings row is this module's aggregate. Tokens are exported,
  // never the classes behind them.
  exports: [USER_SETTINGS_REPOSITORY, LOCALE_RESOLVER, TypeOrmModule],
})
export class ProfileModule {}
