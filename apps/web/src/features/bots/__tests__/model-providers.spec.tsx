import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelProviders } from '../sections/model-providers';

/**
 * Settings → Model providers. What breaks this: a server with no sealing key
 * (`bot_providers` off) still offering Add, Replace and Remove, whose saves
 * can only answer BOTS_011; a failed Remove said only in a toast that
 * fades, rather than inline until dismissed; or ChatGPT's row offering a key
 * (which the API refuses, BOTS_015) instead of its sign-in.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  botProviders: true as boolean | undefined,
  removeError: null as Error | null,
  reset: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-core/react', () => ({
  useDeploymentCapabilities: () => ({
    data: state.botProviders === undefined ? undefined : { bot_providers: state.botProviders },
  }),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseModelProviders: () => ({
    data: [
      { provider: 'anthropic', configured: true, keyHint: '9f3a', updatedAt: null },
      { provider: 'glm', configured: false, keyHint: null, updatedAt: null },
      { provider: 'chatgpt', configured: false, keyHint: null, updatedAt: null },
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
  ModelProviderKeyDialog: ({ provider }: { provider: string }) => (
    <div data-testid="key-dialog">{provider}</div>
  ),
}));
vi.mock('../dialogs/chatgpt-login', () => ({
  ChatgptLoginDialog: () => <div data-testid="chatgpt-dialog" />,
}));

const editing = () =>
  [
    'settings.modelProviders.removeLabel',
    'settings.modelProviders.replace',
    'settings.modelProviders.add',
  ].map((name) => screen.getByRole('button', { name }) as HTMLButtonElement);

afterEach(() => {
  cleanup();
  state.botProviders = true;
  state.removeError = null;
  state.reset.mockClear();
});

describe('ModelProviders', () => {
  it('offers Add, Replace and Remove on a server that can seal keys', () => {
    render(<ModelProviders />);
    expect(editing().map((button) => button.disabled)).toEqual([false, false, false]);
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
});
