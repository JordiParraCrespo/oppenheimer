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
  const recorder = useRecorder({
    sampleRate: VOICE_SAMPLE_RATE,
    maxSeconds: VOICE_MAX_SECONDS,
    onRecorded: async (wav) => {
      setTranscribing(true);
      const text = await voice.transcribe(wav);
      setTranscribing(false);
      if (text) deliver.current(text);
      else setFailed(text === null);
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
      setFailed(false);
      recorder.start();
    },
    stop: recorder.stop,
    cancel: recorder.cancel,
  };
}

/** `text` added to the end of what a field holds, a space between them. */
export function appendDictation(held: string, text: string): string {
  return held.trim() ? `${held.trimEnd()} ${text}` : text;
}
