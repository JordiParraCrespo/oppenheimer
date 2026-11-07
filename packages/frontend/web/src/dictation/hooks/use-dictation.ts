import { VOICE_MAX_SECONDS, VOICE_SAMPLE_RATE } from '@oppenheimer/shared/schemas/voice';
import { useEffect, useRef, useState } from 'react';
import type { DictationMeter } from '../lib/dictation-meter';
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
  /**
   * Ends the recording (or waits for the one being transcribed) and settles
   * once what was said is in the field: true when it landed or there was
   * nothing to hear, false when it failed. A second call while one waits
   * answers false at once, so one send goes, not two.
   */
  finish: () => Promise<boolean>;
  cancel: () => void;
}

/**
 * One field's dictation (`product/next-steps/voice.md`): the recorder, the
 * trip to `voice.transcribe` when it stops, and the text handed to `onText`
 * for the field to add to what it holds. It keeps its own "transcribing" and
 * its own last problem, so a screen's one `VoiceInput` serves every field on
 * it and each field says only what happened to it.
 */
export function useDictation({
  voice,
  onText,
}: {
  voice: VoiceInput;
  onText: (text: string) => void;
}): Dictation {
  const [transcribing, setTranscribing] = useState(false);
  const [failed, setFailed] = useState(false);
  // A transcription answers seconds after the render that sent it; the text
  // goes to the field as it is then, through this.
  const deliver = useRef(onText);
  useEffect(() => {
    deliver.current = onText;
  });
  const settle = useSettled();
  const recorder = useRecorder({
    sampleRate: VOICE_SAMPLE_RATE,
    maxSeconds: VOICE_MAX_SECONDS,
    onRecorded: async (wav) => {
      setTranscribing(true);
      const text = await voice.transcribe(wav);
      setTranscribing(false);
      if (text) deliver.current(text);
      else setFailed(text === null);
      settle.after(text !== null);
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
      recorder.start();
    },
    stop: () => {
      recorder.stop();
    },
    finish: () => {
      if (settle.waiting()) return Promise.resolve(false);
      const settled = settle.wait();
      // Stopped before a word was recorded (still waiting on the microphone): nothing to wait for.
      if (!transcribing && !recorder.stop()) settle.now(true);
      return settled;
    },
    cancel: recorder.cancel,
  };
}

/**
 * A `finish` waiting for what was said to land: `after` settles it once the
 * render that put the text in the field has committed (the effect
 * synchronises the promise with that commit), so whoever awaited it reads
 * the field with the text in it.
 */
function useSettled() {
  const waiter = useRef<((landed: boolean) => void) | null>(null);
  const [outcome, setOutcome] = useState<boolean | null>(null);
  useEffect(() => {
    if (outcome === null) return;
    setOutcome(null);
    const resolve = waiter.current;
    waiter.current = null;
    resolve?.(outcome);
  }, [outcome]);

  function now(landed: boolean): void {
    const resolve = waiter.current;
    waiter.current = null;
    resolve?.(landed);
  }

  return {
    waiting: () => waiter.current !== null,
    wait: () =>
      new Promise<boolean>((resolve) => {
        waiter.current = resolve;
      }),
    after: (landed: boolean) => {
      if (waiter.current) setOutcome(landed);
    },
    now,
  };
}
