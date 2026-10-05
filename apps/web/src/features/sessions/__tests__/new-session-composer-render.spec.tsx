import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

afterEach(cleanup);

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
});
