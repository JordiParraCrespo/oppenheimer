import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotEngineChips } from '../components/bot-engine-chips';

/**
 * The bot's effort is saved once per adjustment, when the model picker closes.
 * What breaks this: a save per stop the knob crosses, so one slide from Low
 * to Max is a burst of updates that the API's rate limit refuses.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('the bot’s effort, in its model picker', () => {
  it('saves the settled pick once, on close, and not per step', () => {
    const onEffortChange = vi.fn();
    render(
      <BotEngineChips
        provider="anthropic"
        configured={['anthropic']}
        model="claude-fable-5-1"
        effort="low"
        onModelChange={vi.fn()}
        onEffortChange={onEffortChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.model' }));
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider.getAttribute('aria-valuetext')).toBe('sessions.new.effort.high');
    expect(onEffortChange).not.toHaveBeenCalled();

    fireEvent.keyDown(slider, { key: 'Escape' });
    expect(onEffortChange).toHaveBeenCalledTimes(1);
    expect(onEffortChange).toHaveBeenCalledWith('high');
  });

  it('saves no effort beside a model picked in the same popup', () => {
    // What breaks this: a draft flushed on the pick's close is a second save
    // sent beside the model's, and the API writes back the old model with it.
    const onModelChange = vi.fn();
    const onEffortChange = vi.fn();
    render(
      <BotEngineChips
        provider="anthropic"
        configured={['anthropic']}
        model="claude-fable-5-1"
        effort="low"
        onModelChange={onModelChange}
        onEffortChange={onEffortChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'bots.chat.model' }));
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight' });
    const other = screen
      .getAllByRole('option')
      .find((row) => !row.getAttribute('aria-selected')?.includes('true'));
    if (!other) throw new Error('no other model to pick');
    fireEvent.click(other);

    expect(onModelChange).toHaveBeenCalledTimes(1);
    expect(onEffortChange).not.toHaveBeenCalled();
  });
});
