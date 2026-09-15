import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { DEFAULT_USER_SETTINGS } from '@oppenheimer/shared';
import { describe, expect, it } from 'vitest';
import { UserSettingsEntity, type UserSettingsProps } from '../domain/user-settings.entity';

const SAVED: UserSettingsProps = {
  theme: 'dark',
  locale: 'en',
  density: 'compact',
  weeklyDigest: false,
  productUpdates: true,
};

describe('UserSettingsEntity', () => {
  it('is keyed by the user id', () => {
    const settings = UserSettingsEntity.createDefault('user-uuid');
    expect(settings.id).toBe('user-uuid');
    expect(settings.userId).toBe('user-uuid');
  });

  it('starts from the shared defaults', () => {
    const settings = UserSettingsEntity.createDefault('user-uuid');

    expect(settings.theme).toBe(DEFAULT_USER_SETTINGS.theme);
    expect(settings.locale).toBe(DEFAULT_USER_SETTINGS.locale);
    expect(settings.density).toBe(DEFAULT_USER_SETTINGS.density);
    expect(settings.weeklyDigest).toBe(DEFAULT_USER_SETTINGS.weeklyDigest);
    expect(settings.productUpdates).toBe(DEFAULT_USER_SETTINGS.productUpdates);
  });

  it('does not share its props with the defaults object', () => {
    // A shallow copy would let one user's first save mutate the module-level
    // defaults, silently changing what every later account starts with.
    const settings = UserSettingsEntity.createDefault('user-uuid');
    settings.update(SAVED);

    expect(DEFAULT_USER_SETTINGS.theme).toBe('system');
    expect(UserSettingsEntity.createDefault('other').theme).toBe('system');
  });

  it('replaces every preference on update', () => {
    const settings = UserSettingsEntity.createDefault('user-uuid');
    settings.update(SAVED);

    expect(settings.theme).toBe('dark');
    expect(settings.locale).toBe('en');
    expect(settings.density).toBe('compact');
    expect(settings.weeklyDigest).toBe(false);
    expect(settings.productUpdates).toBe(true);
  });

  it('touches updatedAt on update', () => {
    const settings = UserSettingsEntity.create({
      id: 'user-uuid',
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
      props: { ...DEFAULT_USER_SETTINGS },
    });

    settings.update(SAVED);

    expect(settings.updatedAt.getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
  });

  it.each([
    ['theme', { ...SAVED, theme: 'solarized' }],
    ['locale', { ...SAVED, locale: 'fr' }],
    ['density', { ...SAVED, density: 'cosy' }],
  ])('rejects an unknown %s', (_field, props) => {
    const settings = UserSettingsEntity.createDefault('user-uuid');

    expect(() => settings.update(props as UserSettingsProps)).toThrow(ArgumentInvalidException);
  });

  it('rejects an unknown value coming back out of the database', () => {
    // The columns are plain varchar, so a hand-edited row is the realistic way
    // an unknown value reaches the aggregate — validation on construction is
    // what stops it reaching a client that branches on the value.
    expect(() =>
      UserSettingsEntity.create({
        id: 'user-uuid',
        props: { ...SAVED, theme: 'neon' } as unknown as UserSettingsProps,
      }),
    ).toThrow(ArgumentInvalidException);
  });
});
