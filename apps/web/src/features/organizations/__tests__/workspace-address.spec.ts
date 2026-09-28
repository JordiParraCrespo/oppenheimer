import { describe, expect, it } from 'vitest';
import { workspaceAddress, workspaceAddressPrefix } from '../lib/workspace-address';

/**
 * The address is this console's own origin, never a hosted default: a
 * self-hosted deployment printing `oppenheimer.dev/` under the field would
 * quote an address that does not reach the workspace.
 */
describe('workspace address', () => {
  it("prefixes with the console's own host, port included", () => {
    expect(workspaceAddressPrefix()).toBe(`${window.location.host}/`);
    expect(workspaceAddressPrefix()).not.toContain('oppenheimer.dev');
  });

  it('quotes the slug after the prefix', () => {
    expect(workspaceAddress('acme-labs')).toBe(`${window.location.host}/acme-labs`);
  });
});
