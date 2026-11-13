import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewSessionComposer } from '../components/new-session-composer';
import { setNewSessionTask } from '../lib/new-session-task';

/**
 * The composer's render budget: what New session *costs*, not what it shows.
 * The chips are siblings of the textarea, so a draft held above them would
 * re-render all of them on every keystroke. This keeps the draft where it is.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  // The kit's i18n concern registers itself when the kit loads.
  initReactI18next: { type: '3rdParty', init: () => {} },
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}));

/**
 * The kit's dictation, without a microphone: the phase a test sets, a meter
 * a test pushes levels into, and the `onText` the composer handed it, for a
 * test to call as a finished transcription would. What the hook itself does
 * with a recording is the kit's spec (`use-dictation.spec.ts`).
 */
const dictation = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let reading = { levels: [] as number[], elapsedMs: 0 };
  return {
    phase: null as null | 'waiting' | 'recording' | 'transcribing',
    onText: null as null | ((text: string) => void),
    problem: null as null | 'failed',
    finish: (() => Promise.resolve(true)) as () => Promise<boolean>,
    meter: {
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      read: () => reading,
      push: (level: number, elapsedMs: number) => {
        reading = { levels: [...reading.levels, level], elapsedMs };
        for (const listener of listeners) listener();
      },
    },
  };
});
vi.mock('@oppenheimer/frontend-web', async (importOriginal) => {
  const kit = await importOriginal<typeof import('@oppenheimer/frontend-web')>();
  return {
    ...kit,
    useDictation: ({
      voice,
      onText,
    }: {
      voice: { available: boolean };
      onText: (text: string) => void;
    }) => {
      dictation.onText = onText;
      return {
        available: voice.available,
        recording: dictation.phase === 'recording',
        phase: dictation.phase,
        problem: dictation.problem,
        meter: dictation.meter,
        toggle: vi.fn(),
        stop: vi.fn(),
        finish: () => dictation.finish(),
        cancel: vi.fn(),
      };
    },
  };
});

const VOICE = { available: true, transcribe: vi.fn() };

afterEach(() => {
  cleanup();
  setNewSessionTask('');
  dictation.phase = null;
  dictation.problem = null;
  dictation.finish = () => Promise.resolve(true);
});

function Chip({ onRender, label }: { onRender: () => void; label: string }) {
  onRender();
  return <button type="button">{label}</button>;
}

describe('NewSessionComposer', () => {
  it('renders none of the foot row while the task is being typed', () => {
    const onTool = vi.fn();
    const onEngine = vi.fn();

    render(
      <NewSessionComposer
        voice={VOICE}
        onSubmit={vi.fn()}
        tools={<Chip onRender={onTool} label="permission" />}
        engine={<Chip onRender={onEngine} label="engine" />}
      />,
    );

    const textarea = screen.getByRole('textbox');
    onTool.mockClear();
    onEngine.mockClear();

    fireEvent.change(textarea, { target: { value: 'F' } });
    fireEvent.change(textarea, { target: { value: 'Fi' } });
    fireEvent.change(textarea, { target: { value: 'Fix' } });

    expect(onTool).not.toHaveBeenCalled();
    expect(onEngine).not.toHaveBeenCalled();
  });

  it('hands the finished sentence up once, trimmed', () => {
    const onSubmit = vi.fn();
    render(<NewSessionComposer voice={VOICE} onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  Fix the wallet list  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Fix the wallet list', []);
  });

  it('sends nothing for a task of whitespace', () => {
    const onSubmit = vi.fn();
    render(<NewSessionComposer voice={VOICE} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the draft after submitting, so a failure loses nothing', () => {
    render(<NewSessionComposer voice={VOICE} onSubmit={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Fix the wallet list' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // `jest-dom` matchers are not loaded in the render-budget project, which
    // runs without the app's test setup on purpose.
    expect((textarea as HTMLTextAreaElement).value).toBe('Fix the wallet list');
  });

  it('keeps a half-written task across leaving New session and reloading', () => {
    // Opening a session from the sidebar unmounts New session; the task
    // typed there was lost with it.
    const first = render(<NewSessionComposer voice={VOICE} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Fix the wallet' } });
    expect(localStorage.getItem('oppenheimer.new-session.task')).toBe('Fix the wallet');
    first.unmount();

    render(<NewSessionComposer voice={VOICE} onSubmit={vi.fn()} />);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Fix the wallet');
  });

  /** A recording `finish` the test settles: what `useDictation` answers once the text is in. */
  function holdFinish() {
    const settle = { landed: (_landed: boolean) => {} };
    const finish = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          settle.landed = resolve;
        }),
    );
    dictation.finish = finish;
    return { finish, settle };
  }

  it('ends the recording on Enter without sending, and sends on the Enter after it', async () => {
    // What breaks this: Enter mid-recording sending what was said before it
    // was read (it once did, as soon as the transcription landed).
    dictation.phase = 'recording';
    const { finish, settle } = holdFinish();
    const onSubmit = vi.fn();
    render(<NewSessionComposer voice={VOICE} onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Fix the wallet' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(finish).toHaveBeenCalledTimes(1);

    // The transcription lands, then the finish settles.
    dictation.phase = null;
    act(() => dictation.onText?.('list.'));
    await act(async () => settle.landed(true));

    expect(onSubmit).not.toHaveBeenCalled();
    // The caret is after what was said, so the next Enter is the send.
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe('Fix the wallet list.'.length);

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Fix the wallet list.', []);
  });

  it('ends the recording on Enter on the recorder, which takes the focus the mic it replaced dropped', async () => {
    dictation.phase = 'recording';
    const { finish } = holdFinish();
    const { container } = render(<NewSessionComposer voice={VOICE} onSubmit={vi.fn()} />);
    const recorder = container.querySelector('[data-slot="composer-recorder"]') as HTMLElement;

    expect(document.activeElement).toBe(recorder);
    fireEvent.keyDown(recorder, { key: 'Enter' });

    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("leaves Enter on the recorder's Cancel to cancel, never to end the recording", () => {
    dictation.phase = 'recording';
    const { finish } = holdFinish();
    render(<NewSessionComposer voice={VOICE} onSubmit={vi.fn()} />);

    fireEvent.keyDown(screen.getByRole('button', { name: 'common.dictation.cancel' }), {
      key: 'Enter',
    });

    expect(finish).not.toHaveBeenCalled();
  });

  describe('attached files', () => {
    const png = (name = 'screen.png', size = 16) =>
      new File([new Uint8Array(size)], name, { type: 'image/png' });

    function pick(container: HTMLElement, files: File[]) {
      const input = container.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error('no file input');
      fireEvent.change(input, { target: { files } });
    }

    it('hands the picked images up with the sentence, and lists each as a chip', () => {
      const onSubmit = vi.fn();
      const { container } = render(<NewSessionComposer voice={VOICE} onSubmit={onSubmit} />);
      const file = png();

      pick(container, [file]);
      expect(screen.getByText('screen.png')).toBeTruthy();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Match this' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSubmit).toHaveBeenCalledWith('Match this', [file]);
    });

    it('sends a blank terminal with no task, but asks for one once a file is held', () => {
      // A file rides a written task: the create schema refuses files with no
      // prompt, so Send must not let one through empty.
      const onSubmit = vi.fn();
      const { container } = render(
        <NewSessionComposer voice={VOICE} onSubmit={onSubmit} taskOptional />,
      );
      const textarea = screen.getByRole('textbox');

      const send = () =>
        screen.getByRole('button', { name: 'sessions.new.composer.send' }) as HTMLButtonElement;
      expect(send().disabled).toBe(false);

      pick(container, [png()]);
      expect(send().disabled).toBe(true);
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onSubmit).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: /remove/i }));
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onSubmit).toHaveBeenCalledWith('', []);
    });

    it('takes an image pasted into the field as an attachment', () => {
      const onSubmit = vi.fn();
      render(<NewSessionComposer voice={VOICE} onSubmit={onSubmit} />);
      const file = png('pasted.png');
      const textarea = screen.getByRole('textbox');

      fireEvent.paste(textarea, { clipboardData: { files: [file] } });
      fireEvent.change(textarea, { target: { value: 'Look' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSubmit).toHaveBeenCalledWith('Look', [file]);
    });

    it('refuses a file over the size cap, and says why', () => {
      const onSubmit = vi.fn();
      const { container } = render(<NewSessionComposer voice={VOICE} onSubmit={onSubmit} />);

      pick(container, [png('huge.png', 5 * 1024 * 1024 + 1)]);
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.queryByText('huge.png')).toBeNull();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Go' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onSubmit).toHaveBeenCalledWith('Go', []);
    });

    it('takes a PDF, text and an unlabelled screenshot, and refuses what a session never takes', () => {
      render(<NewSessionComposer voice={VOICE} onSubmit={vi.fn()} />);
      const textarea = screen.getByRole('textbox');

      fireEvent.paste(textarea, {
        clipboardData: { files: [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })] },
      });
      expect(screen.getByText('doc.pdf')).toBeTruthy();

      fireEvent.paste(textarea, {
        clipboardData: { files: [new File(['# Notes'], 'notes.md', { type: 'text/markdown' })] },
      });
      expect(screen.getByText('notes.md')).toBeTruthy();

      fireEvent.paste(textarea, {
        clipboardData: { files: [new File(['PK'], 'bundle.zip', { type: 'application/zip' })] },
      });
      expect(screen.queryByText('bundle.zip')).toBeNull();
      expect(screen.getByRole('alert').textContent).toContain('attachNotSupported');

      fireEvent.paste(textarea, {
        clipboardData: { files: [new File([new Uint8Array(8)], 'image.png', { type: '' })] },
      });
      expect(screen.getByText('image.png')).toBeTruthy();
    });

    it('lets a chip be removed before sending', () => {
      const onSubmit = vi.fn();
      const { container } = render(<NewSessionComposer voice={VOICE} onSubmit={onSubmit} />);

      pick(container, [png()]);
      const chip = screen.getByText('screen.png').parentElement;
      const remove = chip?.querySelector('button');
      if (!remove) throw new Error('no remove button');
      fireEvent.click(remove);

      expect(screen.queryByText('screen.png')).toBeNull();
    });
  });

  describe('dictation', () => {
    it("draws a recording's levels in the recorder bar alone", () => {
      dictation.phase = 'recording';
      const onEngine = vi.fn();
      render(
        <NewSessionComposer
          voice={VOICE}
          onSubmit={vi.fn()}
          engine={<Chip onRender={onEngine} label="engine" />}
        />,
      );
      onEngine.mockClear();

      act(() => {
        dictation.meter.push(0.2, 300);
        dictation.meter.push(0.6, 700);
        dictation.meter.push(0.4, 1_200);
      });

      expect(onEngine).not.toHaveBeenCalled();
      expect(screen.getByText('0:01')).toBeTruthy();
    });

    it('adds what was said to the end of the draft, to be read before sending', () => {
      render(<NewSessionComposer voice={VOICE} onSubmit={vi.fn()} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Then ' } });

      act(() => dictation.onText?.('fix the login redirect.'));

      expect(textarea.value).toBe('Then fix the login redirect.');
    });

    it('shows no mic while nobody can hear the workspace', () => {
      render(
        <NewSessionComposer voice={{ available: false, transcribe: vi.fn() }} onSubmit={vi.fn()} />,
      );
      expect(screen.queryByRole('button', { name: 'common.dictation.dictate' })).toBeNull();
    });
  });
});
