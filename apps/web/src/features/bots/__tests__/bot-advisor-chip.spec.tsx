import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotAdvisorChip } from '../components/bot-advisor-chip';

/**
 * The bot's advisor in the composer's foot row. What breaks this: a chip
 * drawn for a model that takes no advisor (a GLM bot, Fable 5.2), whose pick
 * the API can only drop; an advisor offered that the model does not list,
 * which Anthropic refuses on every turn; or "No advisor" saving a string.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { model?: string }) =>
      values?.model ? `${key}:${values.model}` : key,
  }),
}));

afterEach(cleanup);

describe('the bot’s advisor chip', () => {
  it('is not drawn for a model that takes no advisor', () => {
    const { container: glm } = render(
      <BotAdvisorChip provider="glm" model={null} value={null} onValueChange={vi.fn()} />,
    );
    expect(glm.innerHTML).toBe('');
    const { container: fable } = render(
      <BotAdvisorChip
        provider="anthropic"
        model="claude-fable-5-2"
        value={null}
        onValueChange={vi.fn()}
      />,
    );
    expect(fable.innerHTML).toBe('');
  });

  it("offers the model's advisors and No advisor, and saves the pick", () => {
    const onValueChange = vi.fn();
    render(
      <BotAdvisorChip
        provider="anthropic"
        model="claude-sonnet-5-5"
        value="claude-opus-5-5"
        onValueChange={onValueChange}
      />,
    );
    const chip = screen.getByRole('button', { name: 'bots.chat.advisor.label' });
    expect(chip.textContent).toContain('bots.chat.advisor.on:Opus 5.5');
    fireEvent.click(chip);
    const offered = screen.getAllByRole('menuitemradio').map((item) => item.textContent);
    expect(offered.some((text) => text?.includes('Opus 5.5'))).toBe(true);
    expect(offered.some((text) => text?.includes('Opus 4.8'))).toBe(false);
    expect(offered.some((text) => text?.includes('Sonnet 5.5'))).toBe(false);
    fireEvent.click(screen.getByRole('menuitemradio', { name: /bots\.chat\.advisor\.off/ }));
    expect(onValueChange).toHaveBeenCalledWith(null);
  });
});
