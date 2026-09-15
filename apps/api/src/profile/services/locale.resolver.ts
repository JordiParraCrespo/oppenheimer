import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from '@oppenheimer/backend-i18n';
import type { Repository } from 'typeorm';
import { UserOrmEntity } from '../../users/database/user.orm-entity';
import type { UserSettingsRepositoryPort } from '../database/user-settings.repository.port';
import { USER_SETTINGS_REPOSITORY } from '../profile.di-tokens';

export interface ResolvedLocale {
  locale: string;
  timeZone: string;
}

/**
 * Which language to write to someone who is not making a request — a queued
 * email has no `Accept-Language` to read, so the only signal is the locale the
 * recipient saved in their settings. Falls back to the deployment default
 * (`I18nModule.forRoot`'s `defaultLocale`) for an account that never chose,
 * and for an invitee who has no account yet.
 *
 * Timezone is not a preference this boilerplate stores, so it is the default
 * zone; it is carried in the result so a caller formatting dates never has to
 * know that.
 */
@Injectable()
export class LocaleResolver {
  constructor(
    private readonly i18n: I18nService,
    @Inject(USER_SETTINGS_REPOSITORY)
    private readonly settings: UserSettingsRepositoryPort,
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {}

  async resolveForRecipient(userId: string): Promise<ResolvedLocale> {
    const found = await this.settings.findOneById(userId);
    return this.resolved(found.isSome() ? found.unwrap().locale : null);
  }

  /**
   * Resolve an email address: an invitee may already be a user with a saved
   * language, or a brand-new address that gets the default.
   */
  async resolveForEmailRecipient(email: string): Promise<ResolvedLocale> {
    const user = await this.users.findOne({ where: { email }, select: { id: true } });
    return user ? this.resolveForRecipient(user.id) : this.resolved(null);
  }

  private resolved(preferred: string | null): ResolvedLocale {
    const formatter = this.i18n.for(this.i18n.negotiate(preferred));
    return { locale: formatter.locale, timeZone: formatter.timeZone };
  }
}
