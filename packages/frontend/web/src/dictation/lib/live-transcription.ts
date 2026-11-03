import { VOICE_LIVE_SAMPLE_RATE } from '@oppenheimer/shared/schemas/voice';
import { resample } from './wav';

/** Where a live dictation streams to, and the short-lived secret that opens it (`POST /voice/live`). */
export interface LiveTicket {
  url: string;
  secret: string;
}

/** One live dictation's socket, while a recording runs. */
export interface LiveTranscription {
  /** One chunk of the microphone's samples, at the rate it records at. */
  push(samples: Float32Array, inputRate: number): void;
  /**
   * Ends the audio and waits, at most {@link FINISH_WAIT_MS}, for the last
   * words: what was heard, or null when the socket never heard anything.
   * The socket is closed after.
   */
  finish(): Promise<string | null>;
  /** Drops the session at once: a cancelled recording, or a screen that went away. */
  close(): void;
}

/** How long the last words may take after the audio ends; the recording's own transcription is on its way anyway. */
const FINISH_WAIT_MS = 4_000;

/**
 * Live dictation (`product/next-steps/voice.md`): a recording streamed to
 * OpenAI's realtime transcription while it is made, and `onText` handed
 * everything heard so far each time a word lands. The socket opens on the
 * ticket's secret (`openai-insecure-api-key.<secret>` is the subprotocol
 * OpenAI takes from a browser: the secret opens one session for a minute,
 * never the deployment's key). Audio pushed before it opens waits, so the
 * first words are not lost to the handshake.
 *
 * Turn detection is off for the session, so every word belongs to the one
 * item the final `commit` closes; items are still kept by id and in the
 * order they began, since OpenAI says completions may arrive out of order.
 * A socket that fails says nothing: the recording's own transcription
 * stands in for it when it stops.
 */
export function openLiveTranscription(
  ticket: LiveTicket,
  onText: (text: string) => void,
): LiveTranscription {
  const socket = new WebSocket(ticket.url, [
    'realtime',
    `openai-insecure-api-key.${ticket.secret}`,
  ]);
  const waiting: string[] = [];
  const order: string[] = [];
  const heard = new Map<string, string>();
  let completed = false;
  let closed = false;
  let settle: (() => void) | null = null;

  const text = () =>
    order
      .map((id) => heard.get(id)?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
  const hear = (id: string, words: string, replace: boolean) => {
    if (!heard.has(id)) order.push(id);
    heard.set(id, replace ? words : (heard.get(id) ?? '') + words);
    onText(text());
  };
  const send = (event: object) => {
    const frame = JSON.stringify(event);
    if (socket.readyState === WebSocket.OPEN) socket.send(frame);
    else if (socket.readyState === WebSocket.CONNECTING) waiting.push(frame);
  };
  const end = () => {
    closed = true;
    settle?.();
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
  };

  socket.addEventListener('open', () => {
    for (const frame of waiting.splice(0)) socket.send(frame);
  });
  socket.addEventListener('message', (message) => {
    const event = eventOf(message.data);
    if (!event) return;
    if (event.type === 'conversation.item.input_audio_transcription.delta' && event.delta) {
      hear(event.item_id, event.delta, false);
    } else if (event.type === 'conversation.item.input_audio_transcription.completed') {
      hear(event.item_id, event.transcript ?? '', true);
      completed = true;
      settle?.();
    } else if (
      event.type === 'error' ||
      event.type === 'conversation.item.input_audio_transcription.failed'
    ) {
      end();
    }
  });
  socket.addEventListener('close', () => {
    closed = true;
    settle?.();
  });
  socket.addEventListener('error', () => end());

  return {
    push(samples, inputRate) {
      if (closed || samples.length === 0) return;
      send({
        type: 'input_audio_buffer.append',
        audio: pcm16Base64(resample(samples, inputRate, VOICE_LIVE_SAMPLE_RATE)),
      });
    },
    async finish() {
      if (!closed) {
        send({ type: 'input_audio_buffer.commit' });
        if (!completed) {
          await new Promise<void>((done) => {
            const timer = setTimeout(done, FINISH_WAIT_MS);
            settle = () => {
              clearTimeout(timer);
              done();
            };
          });
        }
      }
      end();
      return order.length > 0 ? text() : null;
    },
    close: end,
  };
}

interface TranscriptionEvent {
  type: string;
  item_id: string;
  delta?: string;
  transcript?: string;
}

/** A server event the transcription reads, or null for anything else. */
function eventOf(data: unknown): TranscriptionEvent | null {
  if (typeof data !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const event = parsed as Partial<TranscriptionEvent>;
    if (typeof event.type !== 'string') return null;
    return { ...event, type: event.type, item_id: String(event.item_id ?? '') };
  } catch {
    return null;
  }
}

/** Float samples as little-endian 16-bit PCM, base64: what `input_audio_buffer.append` takes. */
export function pcm16Base64(samples: Float32Array): string {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true);
  }
  let binary = '';
  // In slices: one call with every byte as an argument overflows the stack on a long chunk.
  for (let at = 0; at < bytes.length; at += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  }
  return btoa(binary);
}
