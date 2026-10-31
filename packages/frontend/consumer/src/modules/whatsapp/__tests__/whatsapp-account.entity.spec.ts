import { describe, expect, it } from 'vitest';
import { WhatsappAccountEntity, type WhatsappAccountStatus } from '../whatsapp-account.entity';

/**
 * What Settings → WhatsApp reads off a linked number: the number as a person
 * writes it, whether the page keeps asking how it stands (only while it
 * pairs), and when it offers Pair again (only once the device is gone).
 */
function account(status: WhatsappAccountStatus, phone: string | null = null) {
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
  );
}

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
});
