import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NewSessionComposer } from '../components/new-session-composer';

/**
 * The composer's render budget.
 *
 * Not a test of what New session shows — of what it *costs*. The screen holds a
 * host chip, a repository picker with a branch pane, an agent-and-model button,
 * a permission menu and an effort slider, and every one of them is a sibling of
 * the textarea. If the draft lived in the section above them, every keystroke
 * would re-render all five, plus whatever the three queries feeding them
 * produced.
 *
 * This assertion is what keeps the draft where it is. It runs under the app's
 * `render-budget` project, which does **not** enable the React Compiler — so
 * what it measures is the structure rather than the build step that would
 * otherwise hide it.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

/** A foot-row control that counts how often it is asked to render. */
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
    expect(onSubmit).toHaveBeenCalledWith('Fix the wallet list');
  });

  it('sends nothing for a task of whitespace', () => {
    const onSubmit = vi.fn();
    render(<NewSessionComposer onSubmit={onSubmit} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  /**
   * A failed create leaves the sentence on screen. Clearing on submit would
   * throw away a paragraph somebody wrote because the network dropped it.
   */
  it('keeps the draft after submitting, so a failure loses nothing', () => {
    render(<NewSessionComposer onSubmit={vi.fn()} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Fix the wallet list' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    // `jest-dom` matchers are not loaded in the render-budget project, which
    // runs without the app's test setup on purpose.
    expect((textarea as HTMLTextAreaElement).value).toBe('Fix the wallet list');
  });
});
