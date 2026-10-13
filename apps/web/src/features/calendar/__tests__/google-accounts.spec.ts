import {
  CalendarEventEntity,
  GoogleCalendarConnectionEntity,
} from '@oppenheimer/frontend-consumer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleItems, toEntry } from '../lib/calendar-items';
import {
  accentOf,
  accountRowState,
  HIDDEN_ACCOUNTS_KEY,
  rememberHiddenAccounts,
  storedHiddenAccounts,
  toggleHiddenAccount,
} from '../lib/google-accounts';

/**
 * A person's Google accounts on the month. What breaks if this regresses: an
 * account's events wear another's colour, an account switched off still
 * draws, a revoked account shows as connected, or unreadable storage breaks
 * the calendar instead of showing every account.
 */
const work = new GoogleCalendarConnectionEntity(
  'c-work',
  'ana@work.example',
  'active',
  0,
  '2026-10-01T00:00:00Z',
);
const home = new GoogleCalendarConnectionEntity(
  'c-home',
  'ana@home.example',
  'active',
  3,
  '2026-10-02T00:00:00Z',
);

const event = (id: string, connectionId: string | null) =>
  new CalendarEventEntity(
    id,
    'google',
    id,
    '',
    '2026-10-05',
    false,
    '09:00',
    '10:00',
    true,
    null,
    connectionId,
  );

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('googleItems', () => {
  it('colours each event by its account and names the account in the tooltip', () => {
    const [standup, dentist] = googleItems(
      [event('standup', 'c-work'), event('dentist', 'c-home')],
      [work, home],
      [],
    ).map(toEntry);
    expect(standup).toMatchObject({
      accent: 'chart-1',
      tip: 'standup · 09:00–10:00 · ana@work.example',
    });
    expect(dentist).toMatchObject({ accent: 'chart-4' });
  });

  it('leaves out the accounts switched off, and events of an account no longer listed', () => {
    const items = googleItems(
      [event('standup', 'c-work'), event('dentist', 'c-home'), event('stray', 'c-gone')],
      [work, home],
      ['c-home'],
    );
    expect(items.map((item) => item.id)).toEqual(['standup']);
  });
});

describe('accounts', () => {
  it('gives each colour index its own accent', () => {
    expect([0, 1, 2, 3, 4].map(accentOf)).toEqual([
      'chart-1',
      'chart-2',
      'chart-3',
      'chart-4',
      'chart-5',
    ]);
  });

  it('reads revoked from the account or its last read, and a failed read apart from it', () => {
    const revoked = new GoogleCalendarConnectionEntity('c', 'a@b', 'revoked', 0, '');
    expect(accountRowState(revoked, undefined)).toBe('revoked');
    expect(accountRowState(work, 'revoked')).toBe('revoked');
    expect(accountRowState(work, 'error')).toBe('failed');
    expect(accountRowState(work, 'ok')).toBe('connected');
  });

  it('keeps the accounts switched off on this device, and reads unreadable storage as none', () => {
    rememberHiddenAccounts(toggleHiddenAccount(toggleHiddenAccount([], 'c-work'), 'c-home'));
    expect(storedHiddenAccounts()).toEqual(['c-work', 'c-home']);
    expect(toggleHiddenAccount(['c-work', 'c-home'], 'c-work')).toEqual(['c-home']);

    window.localStorage.setItem(HIDDEN_ACCOUNTS_KEY, '{not json');
    expect(storedHiddenAccounts()).toEqual([]);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(storedHiddenAccounts()).toEqual([]);
  });
});
