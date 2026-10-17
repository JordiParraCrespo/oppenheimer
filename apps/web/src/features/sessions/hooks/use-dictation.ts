import { useEffect, useRef, useState } from 'react';
import { DictationMeter } from '../lib/dictation-meter';
import { encodeWav, levelOf } from '../lib/wav';

/** Where a dictation is: nothing, asking for the microphone, or recording. */
export type DictationState = 'idle' | 'waiting' | 'recording';

/** Why the microphone could not be opened: refused by the person or the browser, or none there. */
export type DictationFailure = 'denied' | 'unavailable';

export interface Dictation {
  state: DictationState;
  failure: DictationFailure | null;
  /** The live levels and time, for the recorder bar alone to subscribe to. */
  meter: DictationMeter;
  start: () => void;
  /** Ends the recording and hands it over as a WAV. */
  stop: () => void;
  /** Ends the recording and drops it. */
  cancel: () => void;
}

interface Recording {
  stream: MediaStream;
  context: AudioContext;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
  startedAt: number;
}

/** Closes what `holder` has open and empties it, so the browser's recording light goes out. */
function closeRecording(holder: { current: Recording | null }): Recording | null {
  const open = holder.current;
  holder.current = null;
  if (!open) return null;
  open.processor.onaudioprocess = null;
  open.processor.disconnect();
  for (const track of open.stream.getTracks()) track.stop();
  void open.context.close().catch(() => undefined);
  return open;
}

/** Samples per callback: about 85 ms at 48 kHz, so the waveform moves twelve times a second. */
const CHUNK = 4096;

/**
 * Records one dictation from the microphone (`product/next-steps/voice.md`)
 * and hands it to `onRecorded` as the WAV the API takes: 16-bit PCM, mono, at
 * `sampleRate`. It knows nothing of where the audio goes next; the screen
 * that uses it does.
 *
 * Plain Web Audio rather than `MediaRecorder`, because the browsers record
 * Opus or AAC and ChatGPT's dictation route takes WAV: the samples are kept
 * as they arrive and encoded once, at the end. A recording that reaches
 * `maxSeconds` stops on its own and is handed over like any other.
 *
 * The effects synchronise with the microphone: the audio callback reads the
 * latest `onRecorded`, and whatever is open when the screen unmounts is
 * closed, so the browser's recording light goes out.
 */
export function useDictation({
  onRecorded,
  sampleRate,
  maxSeconds,
}: {
  onRecorded: (wav: Blob) => void;
  sampleRate: number;
  maxSeconds: number;
}): Dictation {
  const [state, setState] = useState<DictationState>('idle');
  const [failure, setFailure] = useState<DictationFailure | null>(null);
  const [meter] = useState(() => new DictationMeter());
  const recording = useRef<Recording | null>(null);
  // Bumped by every start, stop and cancel, so a microphone that answers after
  // the person gave up is closed rather than recorded from.
  const attempt = useRef(0);
  // The audio callback outlives the render that started it; it hands over
  // through this, which follows the latest `onRecorded`.
  const deliver = useRef(onRecorded);
  useEffect(() => {
    deliver.current = onRecorded;
  });

  function finish(keep: boolean): void {
    attempt.current += 1;
    const open = closeRecording(recording);
    meter.reset();
    setState('idle');
    if (keep && open && open.chunks.length > 0) {
      deliver.current(encodeWav(open.chunks, open.context.sampleRate, sampleRate));
    }
  }

  async function start(): Promise<void> {
    if (state !== 'idle') return;
    const mine = ++attempt.current;
    setFailure(null);
    setState('waiting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (error) {
      if (mine !== attempt.current) return;
      setFailure(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'denied'
          : 'unavailable',
      );
      setState('idle');
      return;
    }
    if (mine !== attempt.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(CHUNK, 1, 1);
    const open: Recording = {
      stream,
      context,
      processor,
      chunks: [],
      startedAt: context.currentTime,
    };
    processor.onaudioprocess = (event) => {
      const chunk = new Float32Array(event.inputBuffer.getChannelData(0));
      open.chunks.push(chunk);
      const elapsed = context.currentTime - open.startedAt;
      meter.push(levelOf(chunk), elapsed * 1000);
      if (elapsed >= maxSeconds) finish(true);
    };
    source.connect(processor);
    // A processor that reaches no destination is never called in Chrome; its output is silence.
    processor.connect(context.destination);
    recording.current = open;
    setState('recording');
  }

  useEffect(
    () => () => {
      attempt.current += 1;
      closeRecording(recording);
    },
    [],
  );

  return {
    state,
    failure,
    meter,
    start: () => void start(),
    stop: () => finish(true),
    cancel: () => finish(false),
  };
}
