import { isPublicAddress, refuseUrl } from '../domain/web-address.policy';

/**
 * What `web_fetch` may reach: public unicast addresses only. The battle
 * tests had a bot's fetch reach the control plane's loopback; these are the
 * addresses that would have let it reach the server's own surroundings.
 */
describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '64:ff9b::a00:1',
    '2002:7f00:1::',
    '2001:0:4136:e378::1',
    'not-an-address',
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(['93.184.215.14', '1.1.1.1', '2606:4700:4700::1111', '::ffff:93.184.215.14'])(
    'allows %s',
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe('refuseUrl', () => {
  it.each([
    ['file:///etc/hostname', 'Only http and https'],
    ['ftp://example.com/', 'Only http and https'],
    ['https://user:secret@example.com/', 'user name or password'],
    ['http://localhost:3001/api', 'not on the public internet'],
    ['http://api.localhost/', 'not on the public internet'],
    ['http://metadata.google.internal/', 'not on the public internet'],
    ['http://127.0.0.1:8000/', 'not on the public internet'],
    ['http://[::1]/', 'not on the public internet'],
    ['http://169.254.169.254/latest/meta-data/', 'not on the public internet'],
  ])('refuses %s', (url, reason) => {
    expect(refuseUrl(new URL(url))).toContain(reason);
  });

  it('lets a public https URL through to be resolved', () => {
    expect(refuseUrl(new URL('https://example.com/docs'))).toBeNull();
  });
});
