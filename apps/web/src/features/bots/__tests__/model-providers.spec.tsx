import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelProviders } from '../sections/model-providers';

/**
 * Settings → Model providers. What breaks this: a server with no sealing key
 * (`bot_providers` off) still offering Add, Replace and Remove, whose saves
 * can only answer BOTS_011; a failed Remove said only in a toast that
 * fades, rather than inline until dismissed; or Make default offered on a
 * provider with no key, which the API refuses with BOTS_017.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  botProviders: true as boolean | undefined,
  removeError: null as Error | null,
  reset: vi.fn(),
  makeDefault: vi.fn(),
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
      },
      { provider: 'glm', configured: false, keyHint: null, updatedAt: null, isDefault: false },
      { provider: 'openai', configured: true, keyHint: '12ab', updatedAt: null, isDefault: false },
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

vi.mock('../dialogs/model-provider-key', () => ({ ModelProviderKeyDialog: () => null }));

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
});

describe('ModelProviders', () => {
  it('offers Add, Replace and Remove on a server that can seal keys', () => {
    render(<ModelProviders />);
    expect(editing().every((button) => !button.disabled)).toBe(true);
  });

  it('says Default on the provider new bots start on and offers Make default only on another with a key', () => {
    render(<ModelProviders />);
    const [anthropic, glm, openai] = screen.getAllByTestId('model-provider');
    expect(anthropic.textContent).toContain('settings.modelProviders.default');
    expect(glm.textContent).not.toContain('settings.modelProviders.makeDefault');
    const makeDefault = screen.getByRole('button', {
      name: 'settings.modelProviders.makeDefaultLabel',
    });
    expect(openai.contains(makeDefault)).toBe(true);
    fireEvent.click(makeDefault);
    expect(state.makeDefault).toHaveBeenCalledWith('openai');
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
});
