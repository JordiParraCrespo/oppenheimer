import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelProviders } from '../sections/model-providers';

/**
 * Settings → Model providers. What breaks this: a server with no sealing key
 * (`bot_providers` off) still offering Add, Replace and Remove, whose saves
 * can only answer BOTS_011; a failed Remove said only in a toast that
 * fades, rather than inline until dismissed; Make default offered on a
 * provider with no key, which the API refuses with BOTS_023; or ChatGPT's
 * row offering a key (which the API refuses, BOTS_017) instead of its sign-in;
 * or a provider with no key listed among the connected ones.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  botProviders: true as boolean | undefined,
  removeError: null as Error | null,
  reset: vi.fn(),
  makeDefault: vi.fn(),
  removeKey: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useDeploymentCapabilities: () => ({
    data: state.botProviders === undefined ? undefined : { bot_providers: state.botProviders },
  }),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseModelProviders: () => ({
    data: [
      {
        provider: 'anthropic',
        configured: true,
        keyHint: '9f3a',
        updatedAt: null,
        isDefault: true,
        keys: [{ id: 'a1', keyHint: '9f3a', spentAt: null }],
      },
      {
        provider: 'glm',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
        keys: [],
      },
      {
        provider: 'openai',
        configured: true,
        keyHint: '12ab',
        updatedAt: null,
        isDefault: false,
        keys: [{ id: 'o1', keyHint: '12ab', spentAt: null }],
      },
      {
        provider: 'chatgpt',
        configured: false,
        keyHint: null,
        updatedAt: null,
        isDefault: false,
        keys: [],
      },
      {
        provider: 'xai',
        configured: true,
        keyHint: 'xa01',
        updatedAt: null,
        isDefault: false,
        keys: [
          { id: 'x1', keyHint: 'xa01', spentAt: new Date('2026-11-20T10:00:00Z') },
          { id: 'x2', keyHint: 'xa02', spentAt: null },
        ],
      },
      {
        provider: 'groq',
        configured: true,
        keyHint: 'gq12',
        updatedAt: null,
        isDefault: false,
        keys: [{ id: 'g1', keyHint: 'gq12', spentAt: null }],
      },
    ],
    error: null,
  }),
  useRemoveModelProviderKey: () => ({
    mutate: vi.fn(),
    isPending: false,
    variables: undefined,
    error: state.removeError,
    reset: state.reset,
  }),
  useRemoveModelProviderKeyById: () => ({
    mutate: state.removeKey,
    isPending: false,
    variables: undefined,
    error: null,
    reset: vi.fn(),
  }),
  useSetDefaultModelProvider: () => ({
    mutate: state.makeDefault,
    isPending: false,
    variables: undefined,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: ({ error, onDismiss }: { error: Error | null; onDismiss?: () => void }) =>
    error ? (
      <div role="alert">
        {error.message}
        {onDismiss ? (
          <button type="button" onClick={onDismiss}>
            dismiss
          </button>
        ) : null}
      </div>
    ) : null,
}));

vi.mock('../dialogs/model-provider-key', () => ({
  ModelProviderKeyDialog: ({ target }: { target: { provider: string; mode: string } }) => (
    <div data-testid="key-dialog">{`${target.mode} ${target.provider}`}</div>
  ),
}));
vi.mock('../dialogs/chatgpt-login', () => ({
  ChatgptLoginDialog: () => <div data-testid="chatgpt-dialog" />,
}));

const editing = () =>
  [
    ...screen.getAllByRole('button', { name: 'settings.modelProviders.removeLabel' }),
    ...screen.getAllByRole('button', { name: 'settings.modelProviders.replace' }),
    screen.getByRole('button', { name: 'settings.modelProviders.add' }),
  ] as HTMLButtonElement[];

afterEach(() => {
  cleanup();
  state.botProviders = true;
  state.removeError = null;
  state.reset.mockClear();
  state.makeDefault.mockClear();
  state.removeKey.mockClear();
});

describe('ModelProviders', () => {
  it('offers Add, Replace and Remove on a server that can seal keys', () => {
    render(<ModelProviders />);
    expect(editing().every((button) => !button.disabled)).toBe(true);
  });

  it('says Default on the provider new bots start on and offers Make default only on another with a key', () => {
    render(<ModelProviders />);
    const row = (name: string) =>
      screen
        .getAllByTestId('model-provider')
        .find((each) => each.textContent?.includes(name)) as HTMLElement;
    expect(row('Anthropic').textContent).toContain('settings.modelProviders.default');
    expect(row('GLM').textContent).not.toContain('settings.modelProviders.makeDefault');
    const makeDefault = within(row('OpenAI')).getByRole('button', {
      name: 'settings.modelProviders.makeDefaultLabel',
    });
    fireEvent.click(makeDefault);
    expect(state.makeDefault).toHaveBeenCalledWith('openai');
  });

  it('lists the providers with a key or a sign-in apart from those without', () => {
    render(<ModelProviders />);
    const rows = (heading: RegExp) =>
      within(screen.getByRole('region', { name: heading }))
        .getAllByTestId('model-provider')
        .map((row) => row.textContent);
    expect(rows(/groups\.connected/)).toEqual([
      expect.stringContaining('Anthropic'),
      expect.stringContaining('OpenAI'),
      expect.stringContaining('Grok'),
      expect.stringContaining('Groq'),
    ]);
    expect(rows(/groups\.notConnected/)).toEqual([
      expect.stringContaining('GLM'),
      expect.stringContaining('ChatGPT'),
    ]);
  });

  it('disables them, the warning as their reason, when the server cannot seal keys', () => {
    state.botProviders = false;
    render(<ModelProviders />);
    for (const button of editing()) {
      expect(button.disabled).toBe(true);
      expect(button.title).toBe('settings.modelProviders.unavailable');
    }
  });

  it('keeps a failed Remove on screen until it is dismissed', () => {
    state.removeError = new Error('BOTS_011');
    render(<ModelProviders />);
    expect(screen.getByRole('alert').textContent).toContain('BOTS_011');
    fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
    expect(state.reset).toHaveBeenCalledOnce();
  });

  it('signs ChatGPT in from its own button, and never opens a key dialog for it', () => {
    render(<ModelProviders />);
    expect(screen.getByText('settings.modelProviders.notConnected')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'settings.modelProviders.connect' }));
    expect(screen.getByTestId('chatgpt-dialog')).toBeTruthy();
    expect(screen.queryByTestId('key-dialog')).toBeNull();
  });

  // What breaks this: Make default on a voice-only key, which the API refuses (BOTS_012).
  it('offers Make default on no voice-only provider, whose key still has Replace and Remove', () => {
    render(<ModelProviders />);
    const groq = screen
      .getAllByTestId('model-provider')
      .find((row) => row.textContent?.includes('Groq')) as HTMLElement;
    expect(
      within(groq).queryByRole('button', { name: 'settings.modelProviders.makeDefault' }),
    ).toBeNull();
    expect(
      within(groq).getByRole('button', { name: 'settings.modelProviders.removeLabel' }),
    ).toBeTruthy();
  });

  // What breaks this: a second key that cannot be seen, removed or replaced on its own, or a key out
  // of credit drawn with the same green check as the one calls run on.
  it('draws each of several keys on a row of its own, in order, the spent one saying so', () => {
    render(<ModelProviders />);
    const keys = screen.getAllByTestId('model-provider-key');
    expect(keys.map((row) => row.textContent)).toEqual([
      expect.stringContaining('settings.modelProviders.keyEndingSpent'),
      expect.stringContaining('settings.modelProviders.keyEnding'),
    ]);
    expect(keys[0].textContent).toContain('settings.modelProviders.keySpentNote');
    expect(keys[1].textContent).toContain('settings.modelProviders.keyFirst');
    fireEvent.click(
      within(keys[1]).getByRole('button', { name: 'settings.modelProviders.removeKeyLabel' }),
    );
    expect(state.removeKey).toHaveBeenCalledWith({ provider: 'xai', keyId: 'x2' });
    fireEvent.click(
      within(keys[0]).getByRole('button', { name: 'settings.modelProviders.replaceKeyLabel' }),
    );
    expect(screen.getByTestId('key-dialog').textContent).toBe('replace xai');
  });

  it("adds another key from a connected key provider's row, and none to a sign-in", () => {
    render(<ModelProviders />);
    const adds = screen.getAllByRole('button', { name: 'settings.modelProviders.addKeyLabel' });
    // Anthropic, OpenAI, Grok and Groq: every connected key provider, never ChatGPT.
    expect(adds).toHaveLength(4);
    fireEvent.click(adds[0]);
    expect(screen.getByTestId('key-dialog').textContent).toBe('add anthropic');
  });

  // What breaks this: Remove on a one-key row deletes the provider's whole set, a key another tab
  // added meanwhile included.
  it("removes and replaces a provider's only key by its id", () => {
    render(<ModelProviders />);
    const anthropic = screen
      .getAllByTestId('model-provider')
      .find((row) => row.textContent?.includes('Anthropic')) as HTMLElement;
    fireEvent.click(
      within(anthropic).getByRole('button', { name: 'settings.modelProviders.removeLabel' }),
    );
    expect(state.removeKey).toHaveBeenCalledWith({ provider: 'anthropic', keyId: 'a1' });
    fireEvent.click(
      within(anthropic).getByRole('button', { name: 'settings.modelProviders.replace' }),
    );
    expect(screen.getByTestId('key-dialog').textContent).toBe('replace anthropic');
  });
});
