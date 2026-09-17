import { describe, expect, it } from 'vitest';
import { ProfileEntity, UserSessionEntity } from '../profile.entity';

function profile(firstName: string, lastName: string): ProfileEntity {
  return new ProfileEntity(
    'user-1',
    'adri@example.com',
    firstName,
    lastName,
    null,
    null,
    null,
    'owner',
    true,
    false,
    new Date('2026-06-01T00:00:00.000Z'),
    new Date('2026-06-01T00:00:00.000Z'),
  );
}

function session(userAgent: string | null): UserSessionEntity {
  return new UserSessionEntity(
    'session-1',
    '203.0.113.7',
    userAgent,
    false,
    new Date('2026-06-01T00:00:00.000Z'),
    new Date('2026-06-01T00:00:00.000Z'),
    new Date('2026-07-01T00:00:00.000Z'),
  );
}

const AGENTS = {
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  ipadSafari:
    'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/604.1',
  androidFirefox: 'Mozilla/5.0 (Android 15; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
};

describe('ProfileEntity', () => {
  it('joins the two names for display', () => {
    expect(profile('Adri', 'Rodrigo').fullName).toBe('Adri Rodrigo');
  });

  it('builds initials from the first letter of each name', () => {
    expect(profile('adri', 'rodrigo').initials).toBe('AR');
  });
});

describe('UserSessionEntity.deviceKind', () => {
  it('reads a phone or a tablet as mobile', () => {
    expect(session(AGENTS.iphoneSafari).deviceKind).toBe('mobile');
    expect(session(AGENTS.androidFirefox).deviceKind).toBe('mobile');
    expect(session(AGENTS.ipadSafari).deviceKind).toBe('mobile');
  });

  it('reads a laptop as desktop', () => {
    expect(session(AGENTS.macChrome).deviceKind).toBe('desktop');
    expect(session(AGENTS.windowsEdge).deviceKind).toBe('desktop');
  });

  it('falls back to desktop when there is no agent to read', () => {
    expect(session(null).deviceKind).toBe('desktop');
  });
});

describe('UserSessionEntity.deviceLabel', () => {
  it('names the platform then the browser', () => {
    expect(session(AGENTS.macChrome).deviceLabel).toBe('macOS · Chrome');
    expect(session(AGENTS.iphoneSafari).deviceLabel).toBe('iOS · Safari');
  });

  it('prefers the specific match where agents overlap', () => {
    // Edge and Chrome both say "Chrome"; iPadOS also says "Macintosh".
    expect(session(AGENTS.windowsEdge).deviceLabel).toBe('Windows · Edge');
    expect(session(AGENTS.ipadSafari).deviceLabel).toBe('iPadOS · Safari');
  });

  it('answers null when nothing is recognisable, rather than echoing the agent', () => {
    // The screen has its own words for an unknown device; a raw agent string
    // on a "do you recognise this?" list helps nobody.
    expect(session(null).deviceLabel).toBeNull();
    expect(session('curl/8.4.0').deviceLabel).toBeNull();
  });

  it('names whichever half it could read', () => {
    expect(session('Mozilla/5.0 (Windows NT 10.0)').deviceLabel).toBe('Windows');
  });
});
