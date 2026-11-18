import { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ChatTurn } from '../components/chat-turn';

/**
 * A session chat's turn copies what was said: the prompt from under its card,
 * a settled answer from the trail beneath it. The answer is the agent's last
 * words, every reply after its last piece of work, not what it narrated on the
 * way there. What breaks this: the trail copying the whole turn's text, or only
 * the last reply block when one message's text arrives as several.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const writeText = vi.fn(() => Promise.resolve());

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  cleanup();
  writeText.mockClear();
});

let uuid = 0;
const entry = (value: object) => JSON.stringify({ uuid: `e${++uuid}`, ...value });
const prompt = (text: string) => entry({ type: 'user', message: { role: 'user', content: text } });
const reply = (text: string) =>
  entry({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const call = (id: string) =>
  entry({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', id, name: 'Read', input: { file_path: 'a.ts' } }] },
  });
const result = (id: string) =>
  entry({
    type: 'user',
    message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
  });

function settledTurn() {
  const chat = new Chat();
  chat.apply({
    reset: true,
    entries: [
      prompt('Fix the build'),
      reply('Reading the config first.'),
      call('t1'),
      result('t1'),
      reply('Fixed the import.'),
      reply('The build passes.'),
    ],
  });
  const turn = chat.snapshot().turns.at(-1);
  if (!turn) throw new Error('no turn');
  return turn;
}

it('copies the prompt from under its card', async () => {
  render(<ChatTurn turn={settledTurn()} />);
  await act(async () => fireEvent.click(screen.getByLabelText('sessions.chat.copyMessage')));
  expect(writeText).toHaveBeenCalledWith('Fix the build');
});

it("copies a settled turn's answer, all of its last words and none of the narration", async () => {
  render(<ChatTurn turn={settledTurn()} />);
  await act(async () => fireEvent.click(screen.getByLabelText('sessions.chat.copyReply')));
  expect(writeText).toHaveBeenCalledWith('Fixed the import.\n\nThe build passes.');
});
