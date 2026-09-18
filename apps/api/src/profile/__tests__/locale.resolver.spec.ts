import { I18nService } from '@oppenheimer/backend-i18n';
import { None, Some } from 'oxide.ts';
import { describe, expect, it, vi } from 'vitest';
import { LocaleResolver } from '../application/locale.resolver';
import { UserSettingsEntity } from '../domain/user-settings.entity';

function resolver(saved: UserSettingsEntity | null, userId: string | null = 'user-1') {
  const i18n = new I18nService({
    bundles: { en: {}, es: {} },
    defaultLocale: 'en',
    defaultTimeZone: 'UTC',
    onMissingKey: () => {},
  });
  const settings = { findOneById: vi.fn().mockResolvedValue(saved ? Some(saved) : None) };
  const users = {
    findOneByEmail: vi.fn().mockResolvedValue(userId ? Some({ id: userId }) : None),
  };
  return new LocaleResolver(i18n, settings as never, users as never);
}

function savedIn(locale: 'en' | 'es'): UserSettingsEntity {
  const settings = UserSettingsEntity.createDefault('user-1');
  settings.update({
    theme: 'system',
    locale,
    density: 'comfortable',
    weeklyDigest: true,
    productUpdates: false,
  });
  return settings;
}

describe('LocaleResolver', () => {
  it('writes to a user in the language they saved', async () => {
    await expect(resolver(savedIn('es')).resolveForRecipient('user-1')).resolves.toEqual({
      locale: 'es',
      timeZone: 'UTC',
    });
  });

  it('falls back to the default for an account that never chose', async () => {
    // No settings row is provisioned at sign-up; the default must not be a
    // 404 nor a blank the template renders as "undefined".
    await expect(resolver(null).resolveForRecipient('user-1')).resolves.toEqual({
      locale: 'en',
      timeZone: 'UTC',
    });
  });

  it('resolves an invitee who already has an account by their saved language', async () => {
    await expect(
      resolver(savedIn('es')).resolveForEmailRecipient('ana@example.com'),
    ).resolves.toMatchObject({ locale: 'es' });
  });

  it('gives a brand-new invitee the default', async () => {
    const subject = resolver(savedIn('es'), null);

    await expect(subject.resolveForEmailRecipient('new@example.com')).resolves.toMatchObject({
      locale: 'en',
    });
  });
});
