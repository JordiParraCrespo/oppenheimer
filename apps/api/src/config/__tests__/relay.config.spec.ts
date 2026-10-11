import { afterEach, describe, expect, it } from 'vitest';
import { relayConfig } from '../relay.config';

function withIceServers(value: string | undefined) {
  if (value === undefined) delete process.env.RELAY_ICE_SERVERS;
  else process.env.RELAY_ICE_SERVERS = value;
  return relayConfig();
}

describe('relayConfig', () => {
  afterEach(() => {
    delete process.env.RELAY_ICE_SERVERS;
  });

  it('has no ICE servers by default, which leaves only host candidates', () => {
    expect(withIceServers(undefined).iceServers).toEqual([]);
    expect(withIceServers('').iceServers).toEqual([]);
  });

  it('reads a comma-separated list of STUN and TURN URLs', () => {
    expect(
      withIceServers('stun:stun.example.com:3478, turns:turn.example.com:5349').iceServers,
    ).toEqual(['stun:stun.example.com:3478', 'turns:turn.example.com:5349']);
  });

  it('refuses to boot on something that is not an ICE server, naming the variable', () => {
    expect(() => withIceServers('https://stun.example.com')).toThrow(/RELAY_ICE_SERVERS/);
  });
});
