import { VOICE_MAX_SECONDS, VOICE_SAMPLE_RATE } from '@oppenheimer/shared/schemas/voice';
import { useEffect, useRef, useState } from 'react';
import type { DictatedText } from '../lib/dictate-into';
import type { DictationMeter } from '../lib/dictation-meter';
import {
  type LiveTicket,
  type LiveTranscription,
  openLiveTranscription,
} from '../lib/live-transcription';
import { useRecorder } from './use-recorder';

/**
 * What a screen hands a field so it can take dictation: whether anyone can
 * hear this workspace, and how to hear one recording. The product package
 * answers it (`useVoiceDictation`); one value serves every field on a screen.
 */
export interface VoiceInput {
  available: boolean;
  /** The recording's text, or null when it could not be transcribed. */
  transcribe: (wav: Blob) => Promise<string | null>;
  /**
   * Present when the words can show while they are spoken: a live session's
   * ticket for one recording, or null when none could be had (the recording
   * is then only heard when it stops).
   */
  live?: () => Promise<LiveTicket | null>;
}

/** Where a field's dictation is, for the bar to draw. */
export type DictationPhase = 'waiting' | 'recording' | 'transcribing';

/** What went wrong last, said under the field until the next try. */
export type DictationProblem = 'denied' | 'unavailable' | 'failed';

export interface Dictation {
  /** Whether the field shows the mic at all. */
  available: boolean;
  recording: boolean;
  /** Null while nothing is happening: the field draws no bar. */
  phase: DictationPhase | null;
  problem: DictationProblem | null;
  meter: DictationMeter;
  /** The mic: starts a recording, or ends one and hands it over. */
  toggle: () => void;
  stop: () => void;
  cancel: () => void;
}

/**
 * One field's dictation (`product/next-steps/voice.md`): the recorder, the
 * trip to `voice.transcribe` when it stops, and the text handed to `onText`
 * for the field to add to what it holds. It keeps its own "transcribing" and
 * its own last problem, so a screen's one `VoiceInput` serves every field on
 * it and each field says only what happened to it.
 *
 * With `voice.live`, the recording also streams to a live session as it is
 * made, and the words heard so far go to the field as they land, each time
 * in place of the last (`onText(text, replacing)`). When it stops, the
 * recording's transcription replaces them, since it is the one tidied and
 * spelled with the screen's names; when that fails, the live words stay as
 * the text. Live is best effort: a session that cannot open leaves dictation
 * as it was without it.
 */
export function useDictation({
  voice,
  onText,
}: {
  voice: VoiceInput;
  onText: DictatedText;
}): Dictation {
  const [transcribing, setTranscribing] = useState(false);
  const [failed, setFailed] = useState(false);
  // A transcription answers seconds after the render that sent it; the text
  // goes to the field as it is then, through this.
  const deliver = useRef(onText);
  useEffect(() => {
    deliver.current = onText;
  });
  const live = useLive(deliver);
  const recorder = useRecorder({
    sampleRate: VOICE_SAMPLE_RATE,
    maxSeconds: VOICE_MAX_SECONDS,
    onChunk: live.push,
    onRecorded: async (wav) => {
      setTranscribing(true);
      const [text, heardLive] = await Promise.all([voice.transcribe(wav), live.finish()]);
      setTranscribing(false);
      const kept = text || heardLive;
      if (kept) live.show(kept);
      else {
        live.show('');
        setFailed(text === null);
      }
    },
  });

  return {
    available: voice.available,
    recording: recorder.state === 'recording',
    phase: transcribing ? 'transcribing' : recorder.state === 'idle' ? null : recorder.state,
    problem: recorder.failure ?? (failed ? 'failed' : null),
    meter: recorder.meter,
    toggle: () => {
      if (recorder.state === 'recording') return recorder.stop();
      // One recording at a time: a second would answer over the first.
      if (transcribing) return;
      setFailed(false);
      if (voice.live) live.open(voice.live);
      recorder.start();
    },
    stop: () => {
      // Stopped before a word was recorded (still waiting on the microphone): nothing will be handed over.
      if (recorder.state !== 'recording') live.cancel();
      recorder.stop();
    },
    cancel: () => {
      live.cancel();
      recorder.cancel();
    },
  };
}

/**
 * One field's live session, while a recording runs: it opens as the
 * recording starts, keeps the chunks heard before it is open, shows the words
 * in the field in place of the ones it showed before, and closes when the
 * recording ends or the field goes away (the effect synchronises with the
 * socket).
 */
function useLive(deliver: { current: DictatedText }) {
  const session = useRef<LiveTranscription | null>(null);
  const early = useRef<{ samples: Float32Array; rate: number }[] | null>(null);
  const shown = useRef('');
  const attempt = useRef(0);

  function show(text: string): void {
    if (text === shown.current) return;
    if (shown.current) deliver.current(text, shown.current);
    else if (text) deliver.current(text);
    shown.current = text;
  }

  function drop(): void {
    attempt.current += 1;
    session.current?.close();
    session.current = null;
    early.current = null;
  }

  useEffect(
    () => () => {
      attempt.current += 1;
      session.current?.close();
    },
    [],
  );

  return {
    open(ticketFor: () => Promise<LiveTicket | null>): void {
      drop();
      shown.current = '';
      const mine = attempt.current;
      early.current = [];
      void ticketFor()
        .catch(() => null)
        .then((ticket) => {
          if (mine !== attempt.current) return;
          const waiting = early.current ?? [];
          early.current = null;
          if (!ticket) return;
          const opened = openLiveTranscription(ticket, (text) => {
            if (mine === attempt.current) show(text);
          });
          for (const chunk of waiting) opened.push(chunk.samples, chunk.rate);
          session.current = opened;
        });
    },
    push(samples: Float32Array, rate: number): void {
      if (session.current) session.current.push(samples, rate);
      else early.current?.push({ samples, rate });
    },
    async finish(): Promise<string | null> {
      const open = session.current;
      // Words that land after this are the recording's transcription's to say.
      attempt.current += 1;
      session.current = null;
      early.current = null;
      return open ? open.finish() : null;
    },
    show,
    cancel(): void {
      drop();
      show('');
    },
  };
}
