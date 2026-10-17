import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewSessionComposer } from '../components/new-session-composer';

/**
 * The composer's render budget: what New session *costs*, not what it shows.
 * The chips are siblings of the textarea, so a draft held above them would
 * re-render all of them on every keystroke. This keeps the draft where it is.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * The recorder, without a microphone: the state a test sets, a real meter,
 * and the `onRecorded` the composer handed it, for a test to call as a
 * finished recording would.
 */
const dictation = vi.hoisted(() => ({
  state: 'idle' as 'idle' | 'waiting' | 'recording',
  onRecorded: null as null | ((wav: Blob) => void),
}));
vi.mock('../hooks/use-dictation', async () => {
  const { DictationMeter } = await import('../lib/dictation-meter');
  const meter = new DictationMeter();
  return {
    meter,
    useDictation: ({ onRecorded }: { onRecorded: (wav: Blob) => void }) => {
      dictation.onRecorded = onRecorded;
      return {
        state: dictation.state,
        failure: null,
        meter,
        start: vi.fn(),
        stop: vi.fn(),
        cancel: vi.fn(),
      };
    },
  };
});

afterEach(() => {
  cleanup();
  dictation.state = 'idle';
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
    render(<NewSessionComposer onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  Fix the wallet list  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('Fix the wallet list', []);
  });

  it('sends nothing for a task of whitespace', () => {
    const onSubmit = vi.fn();
    render(<NewSessionComposer onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the draft after submitting, so a failure loses nothing', () => {
    render(<NewSessionComposer onSubmit={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Fix the wallet list' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // `jest-dom` matchers are not loaded in the render-budget project, which
    // runs without the app's test setup on purpose.
    expect((textarea as HTMLTextAreaElement).value).toBe('Fix the wallet list');
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
      const { container } = render(<NewSessionComposer onSubmit={onSubmit} />);
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
      const { container } = render(<NewSessionComposer onSubmit={onSubmit} taskOptional />);
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
      render(<NewSessionComposer onSubmit={onSubmit} />);
      const file = png('pasted.png');
      const textarea = screen.getByRole('textbox');

      fireEvent.paste(textarea, { clipboardData: { files: [file] } });
      fireEvent.change(textarea, { target: { value: 'Look' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });

      expect(onSubmit).toHaveBeenCalledWith('Look', [file]);
    });

    it('refuses a file over the size cap, and says why', () => {
      const onSubmit = vi.fn();
      const { container } = render(<NewSessionComposer onSubmit={onSubmit} />);

      pick(container, [png('huge.png', 5 * 1024 * 1024 + 1)]);
      expect(screen.getByRole('alert')).toBeTruthy();
      expect(screen.queryByText('huge.png')).toBeNull();

      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Go' } });
      fireEvent.keyDown(textarea, { key: 'Enter' });
      expect(onSubmit).toHaveBeenCalledWith('Go', []);
    });

    it('takes a PDF, text and an unlabelled screenshot, and refuses what a session never takes', () => {
      render(<NewSessionComposer onSubmit={vi.fn()} />);
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
      const { container } = render(<NewSessionComposer onSubmit={onSubmit} />);

      pick(container, [png()]);
      const chip = screen.getByText('screen.png').parentElement;
      const remove = chip?.querySelector('button');
      if (!remove) throw new Error('no remove button');
      fireEvent.click(remove);

      expect(screen.queryByText('screen.png')).toBeNull();
    });
  });

  describe('dictation', () => {
    it("draws a recording's levels in the recorder bar alone", async () => {
      const { meter } = (await import('../hooks/use-dictation')) as unknown as {
        meter: import('../lib/dictation-meter').DictationMeter;
      };
      dictation.state = 'recording';
      const onEngine = vi.fn();
      render(
        <NewSessionComposer
          onSubmit={vi.fn()}
          engine={<Chip onRender={onEngine} label="engine" />}
          dictation={{ transcribe: vi.fn(), transcribing: false }}
        />,
      );
      onEngine.mockClear();

      act(() => {
        meter.push(0.2, 300);
        meter.push(0.6, 700);
        meter.push(0.4, 1_200);
      });

      expect(onEngine).not.toHaveBeenCalled();
      expect(screen.getByText('0:01')).toBeTruthy();
    });

    it('adds what was said to the end of the draft, to be read before sending', async () => {
      const transcribe = vi.fn().mockResolvedValue('fix the login redirect.');
      render(
        <NewSessionComposer onSubmit={vi.fn()} dictation={{ transcribe, transcribing: false }} />,
      );
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Then ' } });

      const wav = new Blob(['wav'], { type: 'audio/wav' });
      await act(async () => {
        await dictation.onRecorded?.(wav);
      });

      expect(transcribe).toHaveBeenCalledWith(wav);
      expect(textarea.value).toBe('Then fix the login redirect.');
    });

    it('leaves the draft alone when nothing came back', async () => {
      render(
        <NewSessionComposer
          onSubmit={vi.fn()}
          dictation={{ transcribe: vi.fn().mockResolvedValue(null), transcribing: false }}
        />,
      );
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'Fix it' } });

      await act(async () => {
        await dictation.onRecorded?.(new Blob());
      });

      expect(textarea.value).toBe('Fix it');
    });
  });
});
