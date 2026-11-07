import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config';

/**
 * The server is configured from the environment, usually the repo's `.env`,
 * where a variable left blank (`OPPENHEIMER_API_TOKEN=`) is how a template
 * says "not set". Read as an empty string it failed the schema with a bare
 * validation dump instead of the entrypoint's "token required" message.
 */
describe('loadConfig', () => {
  it('reads a blank variable as absent, so defaults and the token check apply', () => {
    const config = loadConfig({
      OPPENHEIMER_API_TOKEN: '',
      OPPENHEIMER_API_URL: '  ',
      MCP_PORT: '',
      PORT: '3001',
    });

    expect(config.apiToken).toBeUndefined();
    expect(config.apiUrl).toBe('http://localhost:3001');
    expect(config.port).toBe(3001);
  });

  it('prefers MCP_PORT over PORT, which belongs to the API in a shared .env', () => {
    expect(loadConfig({ MCP_PORT: '3005', PORT: '3001' }).port).toBe(3005);
  });
});
