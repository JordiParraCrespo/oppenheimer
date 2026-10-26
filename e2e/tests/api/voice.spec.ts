import { expect, test } from '@playwright/test';
import { turnOnForEveryone } from '../../support/flags';
import { STUB_TRANSCRIPT, tidied } from '../../support/namer-stub';
import { provisionedUser } from '../../support/web';

/**
 * Dictation against the real control plane: a WAV goes to
 * `POST /v1/voice/transcriptions` and the text comes back tidied. The
 * workspace is not signed in to ChatGPT, so the deployment's own speech
 * server hears it — the stub (`support/namer-stub.ts`), which hears one fixed
 * sentence and tidies it as the polish does. ChatGPT's own route is the
 * gateway spec's; no run here reaches it. `voice_dictation` is on by
 * default; each test still turns it on, so a deployment that switched it
 * off does not fail the suite.
 */

/** One second of 16 kHz mono 16-bit silence, as the console records it. */
function wav(): Buffer {
  const samples = 16_000;
  const out = Buffer.alloc(44 + samples * 2);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + samples * 2, 4);
  out.write('WAVEfmt ', 8, 'ascii');
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(16_000, 24);
  out.writeUInt32LE(32_000, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(samples * 2, 40);
  return out;
}

test.describe('Voice', () => {
  test('says the workspace can dictate, on the deployment speech server', async () => {
    const owner = await provisionedUser('voice-status');

    const response = await owner.api.get('/api/v1/voice/status');

    expect(response.status(), await response.text()).toBe(200);
    expect(await response.json()).toEqual({ available: true, providers: ['speech_key'] });
  });

  test('transcribes a WAV on the deployment speech server and tidies it', async () => {
    const owner = await provisionedUser('voice');
    await turnOnForEveryone(owner.api, 'voice_dictation');

    const response = await owner.api.post('/api/v1/voice/transcriptions', {
      multipart: {
        audio: { name: 'dictation.wav', mimeType: 'audio/wav', buffer: wav() },
        vocabulary: 'oppenheimer\napps/web',
      },
    });

    expect(response.status(), await response.text()).toBe(200);
    expect(await response.json()).toEqual({
      text: tidied(STUB_TRANSCRIPT),
      raw: STUB_TRANSCRIPT,
      provider: 'speech_key',
      polished: true,
    });
  });

  test('refuses what is not a WAV with VOICE_004, before any provider hears it', async () => {
    const owner = await provisionedUser('voice-refused');
    await turnOnForEveryone(owner.api, 'voice_dictation');

    const response = await owner.api.post('/api/v1/voice/transcriptions', {
      multipart: {
        audio: {
          name: 'dictation.wav',
          mimeType: 'audio/wav',
          buffer: Buffer.from('OggS this is not a wav file at all, whatever it is called'),
        },
      },
    });

    expect(response.status()).toBe(415);
    expect(await response.json()).toMatchObject({ code: 'VOICE_004' });
  });
});
