import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotComposer } from '../sections/bot-composer';

/**
 * The bot composer's render budget: the chips in `tools` and `engine` are
 * elements its parent made, so a keystroke in the draft re-renders the field
 * and none of them. A draft held above them would redraw every chip on every
 * keystroke; this keeps it where it is.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({ useNavigate: () => vi.fn() }));

const idle = vi.hoisted(() => () => ({
  mutate: () => {},
  reset: () => {},
  error: null,
  isPending: false,
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useBotActiveTurn: () => null,
  useBotWaitingMessages: () => [],
  useBotGoal: () => ({ data: null }),
  useModelProviders: () => ({ data: true }),
  useSendBotMessage: idle,
  useUploadBotImage: () => ({ mutateAsync: async () => ({ id: 'a1' }) }),
  useCancelBotTurn: idle,
  useVoiceDictation: () => ({ available: false, transcribe: async () => null }),
  useBotSlashCommands: () => ({ data: undefined }),
}));

afterEach(cleanup);

function Chip({ onRender, label }: { onRender: () => void; label: string }) {
  onRender();
  return <button type="button">{label}</button>;
}

describe('BotComposer', () => {
  it('renders none of the chips while the draft is being typed', () => {
    const onTool = vi.fn();
    const onEngine = vi.fn();

    render(
      <BotComposer
        botId="b1"
        name="Ada"
        provider="anthropic"
        model={null}
        tools={<Chip onRender={onTool} label="tools" />}
        engine={<Chip onRender={onEngine} label="engine" />}
      />,
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    onTool.mockClear();
    onEngine.mockClear();

    fireEvent.change(textarea, { target: { value: 'H' } });
    fireEvent.change(textarea, { target: { value: 'Hi' } });
    fireEvent.change(textarea, { target: { value: 'Hi!' } });

    expect(onTool).not.toHaveBeenCalled();
    expect(onEngine).not.toHaveBeenCalled();
    // `jest-dom` matchers are not loaded in the render-budget project.
    expect(textarea.value).toBe('Hi!');
  });
});
