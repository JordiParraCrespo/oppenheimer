import { Module, type Provider } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Session } from '../auth/entities/session.entity';
import { UserOrmEntity } from '../users/database/user.orm-entity';
import { UsersModule } from '../users/user.module';
import { ChangePasswordHttpController } from './commands/change-password/change-password.http.controller';
import { ChangePasswordService } from './commands/change-password/change-password.service';
import { DeleteAvatarHttpController } from './commands/delete-avatar/delete-avatar.http.controller';
import { DeleteAvatarService } from './commands/delete-avatar/delete-avatar.service';
import { RevokeOtherSessionsHttpController } from './commands/revoke-other-sessions/revoke-other-sessions.http.controller';
import { RevokeOtherSessionsService } from './commands/revoke-other-sessions/revoke-other-sessions.service';
import { RevokeSessionHttpController } from './commands/revoke-session/revoke-session.http.controller';
import { RevokeSessionService } from './commands/revoke-session/revoke-session.service';
import { UpdateProfileHttpController } from './commands/update-profile/update-profile.http.controller';
import { UpdateProfileService } from './commands/update-profile/update-profile.service';
import { UpdateUserSettingsHttpController } from './commands/update-user-settings/update-user-settings.http.controller';
import { UpdateUserSettingsService } from './commands/update-user-settings/update-user-settings.service';
import { UploadAvatarHttpController } from './commands/upload-avatar/upload-avatar.http.controller';
import { UploadAvatarService } from './commands/upload-avatar/upload-avatar.service';
import { SessionRepository } from './database/session.repository';
import { UserSettingsOrmEntity } from './database/user-settings.orm-entity';
import { UserSettingsRepository } from './database/user-settings.repository';
import { SESSION_READER, USER_SETTINGS_REPOSITORY } from './profile.di-tokens';
import { ProfileMapper } from './profile.mapper';
import { FindSessionsHttpController } from './queries/find-sessions/find-sessions.http.controller';
import { FindSessionsQueryHandler } from './queries/find-sessions/find-sessions.query-handler';
import { GetProfileHttpController } from './queries/get-profile/get-profile.http.controller';
import { GetProfileQueryHandler } from './queries/get-profile/get-profile.query-handler';
import { GetUserSettingsHttpController } from './queries/get-user-settings/get-user-settings.http.controller';
import { GetUserSettingsQueryHandler } from './queries/get-user-settings/get-user-settings.query-handler';
import { AvatarStorage } from './services/avatar.storage';
import { LocaleResolver } from './services/locale.resolver';
import { ProfileAuthFacade } from './services/profile-auth.facade';

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
  UpdateProfileService,
  UpdateUserSettingsService,
  UploadAvatarService,
  DeleteAvatarService,
  ChangePasswordService,
  RevokeSessionService,
  RevokeOtherSessionsService,
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

const services: Provider[] = [AvatarStorage, ProfileAuthFacade, LocaleResolver];

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
  providers: [...commandHandlers, ...queryHandlers, ...repositories, ...services, ProfileMapper],
  // `LocaleResolver` is what the email worker reads a recipient's language
  // through — the settings row is this module's aggregate.
  exports: [USER_SETTINGS_REPOSITORY, LocaleResolver, TypeOrmModule],
})
export class ProfileModule {}
