import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appendDictation, useDictation, type VoiceInput } from './use-dictation';

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
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('./use-recorder', async () => {
  const { DictationMeter } = await import('../lib/dictation-meter');
  const meter = new DictationMeter();
  return {
    useRecorder: ({ onRecorded }: { onRecorded: (wav: Blob) => Promise<void> }) => {
      recorder.onRecorded = onRecorded;
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

afterEach(() => {
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

describe('appendDictation', () => {
  it('adds the text after what the field holds, one space between, or is the text when it is empty', () => {
    expect(appendDictation('Then  ', 'fix it.')).toBe('Then fix it.');
    expect(appendDictation('   ', 'fix it.')).toBe('fix it.');
  });
});
