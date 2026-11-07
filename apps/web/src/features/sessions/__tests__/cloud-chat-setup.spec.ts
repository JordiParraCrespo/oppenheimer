// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLOUD_CHAT_HOOK_PATH,
  cloudChatApiUrl,
  cloudChatEnvironment,
  cloudChatHost,
  cloudChatSettings,
} from '../lib/cloud-chat-setup';

describe('the cloud chat setup the panel hands out', () => {
  it('runs the one hook it serves in the two modes the hook answers to', () => {
    const settings = JSON.parse(cloudChatSettings());
    const commands = [settings.hooks.SessionStart, settings.hooks.Stop].map(
      (entries) => entries[0].hooks[0].command,
    );
    // Breaks if the panel names a mode or a path the served hook does not take.
    expect(commands).toEqual([
      `node ${CLOUD_CHAT_HOOK_PATH} session-start`,
      `node ${CLOUD_CHAT_HOOK_PATH} stop`,
    ]);
    const hook = readFileSync(resolve(__dirname, '../../../../public/cloud-chat-hook.mjs'), 'utf8');
    expect(hook).toContain("mode === 'stop'");
    // The Stop hook's own timeout outlasts the longest wait it asks the API for.
    expect(settings.hooks.Stop[0].hooks[0].timeout).toBeGreaterThan(120);
  });

  it('points the hook at this console when no API address is configured', () => {
    const api = cloudChatApiUrl(undefined, 'https://app.example.com');
    expect(api).toBe('https://app.example.com');
    expect(cloudChatApiUrl('https://api.example.com/', 'https://app.example.com')).toBe(
      'https://api.example.com',
    );
    expect(cloudChatHost(api)).toBe('app.example.com');
    expect(cloudChatEnvironment(api, 'opp_key')).toContain('OPPENHEIMER_CLOUD_KEY=opp_key');
  });
});
