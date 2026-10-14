import type { BotDocumentEntity } from '@oppenheimer/frontend-consumer';
import { AppError } from '@oppenheimer/frontend-core';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotDocumentEditor } from '../sections/bot-document-editor';

/**
 * The instructions editor saves over the revision it opened on, and when
 * somebody saved the file since, it says which revision the file is at now
 * and offers Reload instead of a dead-end failure; a draft stays in the box.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: object) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const save = vi.hoisted(() => ({
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  error: null as unknown,
}));
const reload = vi.hoisted(() => vi.fn());

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSaveBotDocument: () => save,
  useReloadBotDocuments: () => reload,
}));

const document = {
  name: 'instructions',
  content: '# Job',
  revision: 2,
  isBlank: false,
} as unknown as BotDocumentEntity;

beforeEach(() => {
  save.mutate.mockClear();
  save.reset.mockClear();
  reload.mockClear();
  save.error = null;
});

afterEach(cleanup);

describe('BotDocumentEditor', () => {
  it('saves the draft over the revision it opened on', () => {
    render(<BotDocumentEditor botId="bot-1" document={document} />);
    fireEvent.change(screen.getByLabelText('INSTRUCTIONS.md'), {
      target: { value: '# Job\n- Watch the builds' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'bots.settings.instructions.save' }));

    expect(save.mutate).toHaveBeenCalledWith({
      id: 'bot-1',
      name: 'instructions',
      input: { content: '# Job\n- Watch the builds', baseRevision: 2 },
    });
  });

  it('offers no save while the text is what it opened on', () => {
    render(<BotDocumentEditor botId="bot-1" document={document} />);
    expect(screen.queryByRole('button', { name: 'bots.settings.instructions.save' })).toBeNull();
  });

  it('names the revision the file is at after a conflict, and Reload reads it again', () => {
    save.error = new AppError(
      { code: 'BOTS_CLIENT_009', message: 'Failed to save the revision' },
      {
        problem: {
          type: 'about:blank',
          title: 'The document was changed since it was loaded',
          status: 409,
          code: 'BOTS_006',
          revision: 5,
        },
      },
    );
    render(<BotDocumentEditor botId="bot-1" document={document} />);

    expect(
      screen.getByText(
        'bots.settings.instructions.conflict:{"file":"INSTRUCTIONS.md","revision":5}',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'bots.settings.instructions.reload' }));

    expect(reload).toHaveBeenCalledWith('bot-1');
    expect(save.reset).toHaveBeenCalled();
  });
});
