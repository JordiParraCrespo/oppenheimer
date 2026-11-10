import { describe, expect, it } from 'vitest';
import { WhatsappAccountEntity, type WhatsappAccountStatus } from '../whatsapp-account.entity';

type Owner = {
  ownerNumber?: string | null;
  ownerPendingNumber?: string | null;
  ownerCodeExpiresAt?: string | null;
};

/**
 * What Settings → WhatsApp reads off a linked number: the number as a person
 * writes it, whether the page keeps asking how it stands (only while it
 * pairs), and when it offers Pair again (only once the device is gone).
 */
function account(status: WhatsappAccountStatus, phone: string | null = null, owner: Owner = {}) {
  return new WhatsappAccountEntity(
    'a',
    'h',
    'Spare',
    status,
    true,
    phone,
    null,
    null,
    null,
    null,
    '2026-10-01T09:00:00Z',
    null,
    owner.ownerNumber ?? null,
    owner.ownerPendingNumber ?? null,
    owner.ownerCodeExpiresAt ? new Date(owner.ownerCodeExpiresAt) : null,
  );
}

const connected = (owner: Owner) => account('connected', '34600111222@s.whatsapp.net', owner);

describe('WhatsappAccountEntity', () => {
  it('writes a phone JID as an international number, and a device suffix or a group as none', () => {
    expect(account('connected', '34600111222@s.whatsapp.net').number).toBe('+34600111222');
    expect(account('connected', '34600111222:12@s.whatsapp.net').number).toBe('+34600111222');
    expect(account('connected', '1203@g.us').number).toBeNull();
    expect(account('pairing').number).toBeNull();
  });

  it('polls only while pairing, and offers pairing again only once the device is gone', () => {
    expect(account('pairing').isPairing).toBe(true);
    expect(account('connecting').isPairing).toBe(false);
    expect(account('logged_out').needsPairing).toBe(true);
    expect(account('unlinked').needsPairing).toBe(true);
    expect(account('connected').needsPairing).toBe(false);
  });

  // Breaks if the row asks for a code once the number is confirmed (the API
  // clears the waiting code on confirm), or forgets a code sent to replace a
  // number already confirmed.
  it('asks for the code while one waits, even over a confirmed number, and reads confirmed once it is entered', () => {
    const waiting = {
      ownerPendingNumber: '+34600999888',
      ownerCodeExpiresAt: '2026-10-01T09:10:00Z',
    };
    expect(connected({}).ownerState).toBe('none');
    expect(connected(waiting).ownerState).toBe('codeSent');
    expect(connected({ ...waiting, ownerNumber: '+34600555444' }).ownerState).toBe('codeSent');
    expect(connected({ ownerNumber: '+34600999888' }).ownerState).toBe('confirmed');
  });

  // Breaks if an expired code keeps offering the code form: the API returns
  // the waiting number and its expiry as stored, past the expiry too.
  it('reads a waiting code as expired from its expiry on, and no code as never expired', () => {
    const expiresAt = '2026-10-01T09:10:00Z';
    const waiting = connected({
      ownerPendingNumber: '+34600999888',
      ownerCodeExpiresAt: expiresAt,
    });
    const at = Date.parse(expiresAt);
    expect(waiting.codeExpired(at - 1)).toBe(false);
    expect(waiting.codeExpired(at)).toBe(true);
    expect(connected({}).codeExpired(at)).toBe(false);
  });
});
