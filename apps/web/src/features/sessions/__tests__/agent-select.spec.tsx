import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentSelect } from '../components/agent-select';
import { toEngineAgents } from '../lib/session-options';

/**
 * Claude Code's earlier generations sit behind "More models", the way
 * Claude's own picker keeps them, so the tab stays the four current models.
 * What breaks this: the legacy rows listed with the current ones, or hidden
 * where a search or a session already on one cannot reach them.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

function open(model: string) {
  const onValueChange = vi.fn();
  render(
    <AgentSelect
      agents={toEngineAgents(false, null, [], 'claude-code')}
      value={{ agent: 'claude-code', model }}
      onValueChange={onValueChange}
      favourites={[]}
      onFavouritesChange={vi.fn()}
      effort={null}
      onEffortChange={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'sessions.new.agent.label' }));
  return { onValueChange };
}

const options = () => screen.getAllByRole('option').map((option) => option.textContent);
const more = () => screen.getByRole('button', { name: 'sessions.new.agent.moreModels' });

describe('the engine button’s Claude Code tab', () => {
  it('lists the current models, and the earlier ones under More models', () => {
    const { onValueChange } = open('claude-opus-5-5');
    expect(options()).toEqual(['Opus 5.5', 'Fable 5.2', 'Sonnet 5.5', 'Haiku 5.5']);
    expect(more().getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(more());
    expect(options()).toEqual([
      'Opus 5.5',
      'Fable 5.2',
      'Sonnet 5.5',
      'Haiku 5.5',
      'Fable 5.1',
      'Haiku 4.5',
      'Sonnet 5',
      'Opus 5',
      'Fable 5',
      'Opus 4.8',
      'Opus 4.7',
      'Opus 4.6',
      'Sonnet 4.6',
    ]);

    fireEvent.click(screen.getByRole('option', { name: 'Opus 4.8' }));
    expect(onValueChange).toHaveBeenCalledWith({ agent: 'claude-code', model: 'claude-opus-4-8' });
  });

  it('opens on the earlier models when the session already runs one', () => {
    open('claude-sonnet-4-6');
    expect(more().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('option', { name: 'Sonnet 4.6' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('finds an earlier model by search without opening More models', () => {
    open('claude-opus-5-5');
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'opus 4' } });
    expect(options()).toEqual(['Opus 4.8', 'Opus 4.7', 'Opus 4.6']);
  });
});
