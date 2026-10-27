import { describe, expect, it } from 'vitest';
import { defineManifest } from '../../manifest.config';

/**
 * The permission list is what the install prompt shows a person. A change to
 * it should be a decision, so it fails here first; update the reasons in
 * `manifest.config.ts` and the README with it.
 */
describe('manifest', () => {
  const manifest = defineManifest({ version: '1.2.3' });

  it('asks for exactly the permissions the extension uses', () => {
    expect(manifest.permissions).toEqual(['alarms', 'cookies', 'notifications', 'storage']);
    expect(manifest.host_permissions).toEqual(['https://claude.ai/*']);
    // Asked for at connect time, for the one API the person names.
    expect(manifest.optional_host_permissions).toEqual([
      'https://*/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ]);
  });

  it('only injects into claude.ai, the tap in the page and the bridge beside it', () => {
    expect(manifest.content_scripts).toEqual([
      expect.objectContaining({ matches: ['https://claude.ai/*'], js: ['tap.js'], world: 'MAIN' }),
      expect.objectContaining({ matches: ['https://claude.ai/*'], js: ['bridge.js'] }),
    ]);
  });

  it('takes its version from package.json', () => {
    expect(manifest.version).toBe('1.2.3');
  });
});
