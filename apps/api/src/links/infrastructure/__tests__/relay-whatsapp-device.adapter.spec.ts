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
