import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appendDictation, dictateInto, replaceDictation } from '../lib/dictate-into';
import { useDictation, type VoiceInput } from './use-dictation';

/**
 * One field's dictation over a recorder without a microphone: what a finished
 * recording becomes (text handed to the field, or a problem said under it),
 * and what the field shows meanwhile. The recorder's own audio is
 * `dictation-audio.spec.ts`'s.
 */

const recorder = vi.hoisted(() => ({
  state: 'idle' as 'idle' | 'waiting' | 'recording',
  failure: null as null | 'denied' | 'unavailable',
  onRecorded: null as null | ((wav: Blob) => Promise<void> | void),
  onChunk: null as null | ((samples: Float32Array, rate: number) => void),
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('./use-recorder', async () => {
  const { DictationMeter } = await import('../lib/dictation-meter');
  const meter = new DictationMeter();
  return {
    useRecorder: ({
      onRecorded,
      onChunk,
    }: {
      onRecorded: (wav: Blob) => Promise<void>;
      onChunk?: (samples: Float32Array, rate: number) => void;
    }) => {
      recorder.onRecorded = onRecorded;
      recorder.onChunk = onChunk ?? null;
      return {
        state: recorder.state,
        failure: recorder.failure,
        meter,
        start: recorder.start,
        stop: recorder.stop,
        cancel: vi.fn(),
      };
    },
  };
});

/** The live socket, without a network: what was pushed, the words a test makes it hear, and what it finishes with. */
const live = vi.hoisted(() => ({
  onText: null as null | ((text: string) => void),
  pushed: [] as Float32Array[],
  finishWith: null as string | null,
  closed: false,
}));
vi.mock('../lib/live-transcription', () => ({
  openLiveTranscription: (_ticket: unknown, onText: (text: string) => void) => {
    live.onText = onText;
    return {
      push: (samples: Float32Array) => live.pushed.push(samples),
      finish: async () => live.finishWith,
      close: () => {
        live.closed = true;
      },
    };
  },
}));

afterEach(() => {
  live.onText = null;
  live.pushed = [];
  live.finishWith = null;
  live.closed = false;
  recorder.state = 'idle';
  recorder.failure = null;
  vi.clearAllMocks();
});

const WAV = new Blob(['wav'], { type: 'audio/wav' });

function dictate(voice: VoiceInput) {
  const onText = vi.fn();
  const view = renderHook(() => useDictation({ voice, onText }));
  return { onText, view };
}

describe('useDictation', () => {
  it('hands what was heard to the field, and says it is transcribing meanwhile', async () => {
    let answer: (text: string) => void = () => {};
    const transcribe = vi.fn(() => new Promise<string | null>((done) => (answer = done)));
    const { onText, view } = dictate({ available: true, transcribe });

    let finished: Promise<void> | void;
    act(() => {
      finished = recorder.onRecorded?.(WAV);
    });
    expect(view.result.current.phase).toBe('transcribing');

    await act(async () => {
      answer('fix the login redirect.');
      await finished;
    });

    expect(transcribe).toHaveBeenCalledWith(WAV);
    expect(onText).toHaveBeenCalledWith('fix the login redirect.');
    expect(view.result.current.phase).toBeNull();
    expect(view.result.current.problem).toBeNull();
  });

  it('leaves the field alone and says so when the recording could not be transcribed, until the next try', async () => {
    const { onText, view } = dictate({ available: true, transcribe: async () => null });

    await act(async () => {
      await recorder.onRecorded?.(WAV);
    });
    expect(onText).not.toHaveBeenCalled();
    expect(view.result.current.problem).toBe('failed');

    act(() => view.result.current.toggle());
    expect(recorder.start).toHaveBeenCalled();
    expect(view.result.current.problem).toBeNull();
  });

  it("says why the microphone did not open, and the mic's press stops a recording in progress", () => {
    recorder.failure = 'denied';
    const { view } = dictate({ available: true, transcribe: vi.fn() });
    expect(view.result.current.problem).toBe('denied');

    recorder.failure = null;
    recorder.state = 'recording';
    view.rerender();
    expect(view.result.current.recording).toBe(true);
    act(() => view.result.current.toggle());
    expect(recorder.stop).toHaveBeenCalled();
    expect(recorder.start).not.toHaveBeenCalled();
  });
});

describe('useDictation, live', () => {
  const TICKET = { url: 'wss://live.test', secret: 'ek_1' };

  /** A field in state, as `dictateInto` keeps one, dictated into live. */
  function field(transcribe: VoiceInput['transcribe'], held = 'Then') {
    const draft = { value: held };
    const onText = dictateInto((update) => {
      draft.value = update(draft.value);
    });
    const view = renderHook(() =>
      useDictation({ voice: { available: true, transcribe, live: async () => TICKET }, onText }),
    );
    return { draft, view };
  }

  async function startRecording(view: ReturnType<typeof field>['view']) {
    await act(async () => {
      view.result.current.toggle();
    });
  }

  it('streams what is heard before the socket opens, and shows the words as they land, each in place of the last', async () => {
    const { draft, view } = field(vi.fn());
    const early = new Float32Array(4);
    // A chunk heard while the ticket is on its way waits for the socket.
    act(() => view.result.current.toggle());
    recorder.onChunk?.(early, 48_000);
    await act(async () => {});
    expect(live.pushed).toEqual([early]);

    act(() => live.onText?.('fix the'));
    act(() => live.onText?.('fix the login'));

    expect(draft.value).toBe('Then fix the login');
  });

  it("puts the recording's transcription in place of the live words when it stops", async () => {
    const { draft, view } = field(async () => 'fix the login redirect.');
    await startRecording(view);
    act(() => live.onText?.('fix the log in'));

    await act(async () => {
      await recorder.onRecorded?.(WAV);
    });

    expect(draft.value).toBe('Then fix the login redirect.');
    expect(view.result.current.problem).toBeNull();
  });

  it('keeps the live words as the text when the transcription fails, and says nothing failed', async () => {
    const { draft, view } = field(async () => null);
    await startRecording(view);
    act(() => live.onText?.('fix the login'));
    live.finishWith = 'fix the login redirect';

    await act(async () => {
      await recorder.onRecorded?.(WAV);
    });

    expect(draft.value).toBe('Then fix the login redirect');
    expect(view.result.current.problem).toBeNull();
  });

  it('takes the live words back out of the field when the recording is cancelled', async () => {
    const { draft, view } = field(vi.fn());
    await startRecording(view);
    act(() => live.onText?.('fix the login'));

    act(() => view.result.current.cancel());

    expect(draft.value).toBe('Then');
    expect(live.closed).toBe(true);
  });
});

describe('replaceDictation', () => {
  it('replaces the words dictation put last, and adds after anything the person changed meanwhile', () => {
    expect(replaceDictation('Then fix the', 'fix the', 'fix the login')).toBe('Then fix the login');
    expect(replaceDictation('fix the', 'fix the', '')).toBe('');
    // The person typed after the live words: they stay, and the text goes after.
    expect(replaceDictation('Then fix the, really', 'fix the', 'fix it')).toBe(
      'Then fix the, really fix it',
    );
  });
});

describe('appendDictation', () => {
  it('adds the text after what the field holds, one space between, or is the text when it is empty', () => {
    expect(appendDictation('Then  ', 'fix it.')).toBe('Then fix it.');
    expect(appendDictation('   ', 'fix it.')).toBe('fix it.');
  });
});
