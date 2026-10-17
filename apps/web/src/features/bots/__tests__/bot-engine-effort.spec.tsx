import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotEngineChips } from '../components/bot-engine-chips';

/**
 * The bot's effort is saved once per adjustment, when its popover closes.
 * What breaks this: a save per stop the knob crosses, so one slide from Low
 * to Max is a burst of updates that the API's rate limit refuses.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('the bot’s effort picker', () => {
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

    fireEvent.click(screen.getByRole('button', { name: 'sessions.new.effort.label' }));
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(slider.getAttribute('aria-valuetext')).toBe('sessions.new.effort.high');
    expect(onEffortChange).not.toHaveBeenCalled();

    fireEvent.keyDown(slider, { key: 'Escape' });
    expect(onEffortChange).toHaveBeenCalledTimes(1);
    expect(onEffortChange).toHaveBeenCalledWith('high');
  });
});
