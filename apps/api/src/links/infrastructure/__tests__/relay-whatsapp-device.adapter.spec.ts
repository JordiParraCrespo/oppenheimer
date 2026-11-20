/**
 * Asking a host's runner for a voice note over its link: the frame goes only
 * to a runner that names `whatsapp.voice`, its `whatsapp.media` answer comes
 * back as the note's bytes, and a refusal, a host that is gone or a runner
 * that never answers each come back as what happened, never a throw. The
 * runner's side is `link_whatsapp.go`; hearing the bytes is the
 * `transcribe-whatsapp-voice-note` handler's spec.
 */

import type { ProtocolMessage, RunnerCapability } from '@oppenheimer/shared/protocol';
import { describe, expect, it, vi } from 'vitest';
import type { LinkRegistryPort, RunnerLink } from '../../application/link-registry.port';
import type { LinkRepliesPort, LinkReply } from '../../application/link-replies.port';
import { RelayWhatsappDeviceAdapter } from '../relay-whatsapp-device.adapter';

const HOST = 'host-1';
const CHAT = '34600999888@s.whatsapp.net';

function setup(opts: {
  capabilities?: RunnerCapability[];
  online?: boolean;
  reply?: LinkReply | null;
}) {
  const sent: ProtocolMessage[] = [];
  const link = {
    hostId: HOST,
    capabilities: opts.capabilities ?? ['whatsapp', 'whatsapp.voice'],
    send: (message: ProtocolMessage) => {
      sent.push(message);
      return true;
    },
  } as unknown as RunnerLink;
  const links: Pick<LinkRegistryPort, 'find'> = {
    find: (hostId) => (opts.online === false || hostId !== HOST ? undefined : link),
  };
  const replies: Pick<LinkRepliesPort, 'expect'> = {
    expect: vi.fn(() => ({ reply: Promise.resolve(opts.reply ?? null), cancel: () => {} })),
  };
  const adapter = new RelayWhatsappDeviceAdapter(
    links as LinkRegistryPort,
    replies as LinkRepliesPort,
  );
  return { adapter, sent, replies };
}

describe('RelayWhatsappDeviceAdapter.voiceNote', () => {
  // What breaks this: the note's bytes lost or mangled between the frame and the decoder.
  it('asks a runner that names whatsapp.voice and answers the bytes its whatsapp.media carries', async () => {
    const audio = Buffer.from('OggS voice note bytes');
    const { adapter, sent, replies } = setup({
      reply: {
        type: 'whatsapp.media',
        commandId: 'c',
        mimetype: 'audio/ogg; codecs=opus',
        data: audio.toString('base64'),
      },
    });

    const outcome = await adapter.voiceNote(HOST, CHAT, '3EB0V');

    expect(sent).toEqual([
      {
        type: 'whatsapp.media.get',
        commandId: expect.any(String),
        chatId: CHAT,
        messageId: '3EB0V',
      },
    ]);
    expect(replies.expect).toHaveBeenCalledWith(
      HOST,
      (sent[0] as { commandId: string }).commandId,
      45_000,
    );
    expect(outcome).toEqual({ kind: 'fetched', data: audio, mimetype: 'audio/ogg; codecs=opus' });
  });

  // What breaks this: an older runner sent a frame it logs as unknown and never answers.
  it('sends nothing to a runner without whatsapp.voice, or to a host that is offline', async () => {
    const old = setup({ capabilities: ['whatsapp'] });
    await expect(old.adapter.voiceNote(HOST, CHAT, '3EB0V')).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(old.sent).toEqual([]);

    const gone = setup({ online: false });
    await expect(gone.adapter.voiceNote(HOST, CHAT, '3EB0V')).resolves.toEqual({
      kind: 'host_offline',
    });
  });

  it('answers the runner’s refusal by its code, and silence as timed out', async () => {
    const refused = setup({
      reply: { type: 'command.failed', commandId: 'c', code: 'WA_006', detail: 'too large' },
    });
    await expect(refused.adapter.voiceNote(HOST, CHAT, '3EB0V')).resolves.toEqual({
      kind: 'failed',
      code: 'WA_006',
      detail: 'too large',
    });

    const silent = setup({ reply: null });
    await expect(silent.adapter.voiceNote(HOST, CHAT, '3EB0V')).resolves.toEqual({
      kind: 'timed_out',
    });
  });
});

/**
 * Sending a bot's voice note over the link: the frame goes only to a runner
 * that names `whatsapp.voice.send`, carries the audio whole as base64 with
 * its length, and the host's `whatsapp.sent` or refusal comes back as what
 * happened.
 */
describe('RelayWhatsappDeviceAdapter.sendVoice', () => {
  const VOICE: RunnerCapability[] = ['whatsapp', 'whatsapp.voice', 'whatsapp.voice.send'];
  const audio = Buffer.from('OggS spoken reply');

  // What breaks this: the audio mangled on the way, or sent as anything WhatsApp would not play.
  it('sends the audio whole to a runner that names whatsapp.voice.send and answers its whatsapp.sent', async () => {
    const { adapter, sent, replies } = setup({
      capabilities: VOICE,
      reply: { type: 'whatsapp.sent', commandId: 'c', id: '3EB9', sentAt: '2026-11-20T10:00:00Z' },
    });

    const outcome = await adapter.sendVoice(HOST, CHAT, audio, 3);

    expect(sent).toEqual([
      {
        type: 'whatsapp.send.voice',
        commandId: expect.any(String),
        chatId: CHAT,
        mimetype: 'audio/ogg; codecs=opus',
        data: audio.toString('base64'),
        seconds: 3,
      },
    ]);
    expect(Buffer.from((sent[0] as { data: string }).data, 'base64')).toEqual(audio);
    expect(replies.expect).toHaveBeenCalledWith(
      HOST,
      (sent[0] as { commandId: string }).commandId,
      45_000,
    );
    expect(outcome).toEqual({
      kind: 'sent',
      id: '3EB9',
      sentAt: new Date('2026-11-20T10:00:00Z'),
    });
  });

  // What breaks this: a runner from before voice sends given a frame it never answers.
  it('sends nothing to a runner without whatsapp.voice.send, or to a host that is offline', async () => {
    const old = setup({ capabilities: ['whatsapp', 'whatsapp.voice'] });
    await expect(old.adapter.sendVoice(HOST, CHAT, audio, 3)).resolves.toEqual({
      kind: 'not_supported',
    });
    expect(old.sent).toEqual([]);
    const gone = setup({ capabilities: VOICE, online: false });
    await expect(gone.adapter.sendVoice(HOST, CHAT, audio, 3)).resolves.toEqual({
      kind: 'host_offline',
    });
  });

  it('answers the runner’s refusal by its code, and silence as timed out', async () => {
    const refused = setup({
      capabilities: VOICE,
      reply: { type: 'command.failed', commandId: 'c', code: 'WA_008', detail: 'not Ogg/Opus' },
    });
    await expect(refused.adapter.sendVoice(HOST, CHAT, audio, 3)).resolves.toEqual({
      kind: 'failed',
      code: 'WA_008',
      detail: 'not Ogg/Opus',
    });
    const silent = setup({ capabilities: VOICE, reply: null });
    await expect(silent.adapter.sendVoice(HOST, CHAT, audio, 3)).resolves.toEqual({
      kind: 'timed_out',
    });
  });
});
