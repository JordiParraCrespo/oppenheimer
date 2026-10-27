import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudAgentProviders } from '../sections/cloud-agent-providers';

/**
 * Settings → Cloud agents. What breaks this: a server with no sealing key
 * (`configured` false) still offering Connect, whose save can only answer
 * CLOUD_AGENTS_003; a connected vendor not saying whose key it holds; or a
 * failed Disconnect said nowhere the reader can read it again.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));

const state = vi.hoisted(() => ({
  configured: true,
  connected: false,
  disconnectError: null as Error | null,
  disconnect: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseCloudAgentStatus: () => ({
    data: {
      configured: state.configured,
      available: state.connected,
      providers: [
        {
          id: 'cursor',
          label: 'Cursor',
          connected: state.connected,
          keyName: state.connected ? 'Laptop' : null,
          keyHint: state.connected ? '9f3a' : null,
          accountEmail: state.connected ? 'ana@example.com' : null,
          connectedAt: null,
        },
      ],
    },
    error: null,
  }),
  useDisconnectCloudAgentProvider: () => ({
    mutate: state.disconnect,
    isPending: false,
    variables: undefined,
    error: state.disconnectError,
    reset: vi.fn(),
  }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: ({ error }: { error: Error | null }) =>
    error ? <div role="alert">{error.message}</div> : null,
}));

vi.mock('../dialogs/cloud-agent-key', () => ({
  CloudAgentKeyDialog: ({ provider }: { provider: string }) => (
    <div data-testid="key-dialog">{provider}</div>
  ),
}));

afterEach(() => {
  cleanup();
  Object.assign(state, { configured: true, connected: false, disconnectError: null });
  state.disconnect.mockReset();
});

describe('CloudAgentProviders', () => {
  it('offers Connect on a vendor with no key, and opens the key dialog for it', () => {
    render(<CloudAgentProviders />);

    expect(screen.getByText('settings.cloudAgents.notConnected')).toBeTruthy();
    expect(screen.queryByText('settings.cloudAgents.disconnect')).toBeNull();
    fireEvent.click(screen.getByText('settings.cloudAgents.connect'));
    expect(screen.getByTestId('key-dialog').textContent).toBe('cursor');
  });

  it('says whose key a connected vendor holds, and disconnects it', () => {
    state.connected = true;
    render(<CloudAgentProviders />);

    expect(screen.getByText(/settings\.cloudAgents\.connectedAs/).textContent).toContain(
      'ana@example.com',
    );
    fireEvent.click(screen.getByText('settings.cloudAgents.disconnect'));
    expect(state.disconnect).toHaveBeenCalledWith('cursor');
  });

  it('turns Connect off on a server that cannot keep a key, and says why', () => {
    state.configured = false;
    render(<CloudAgentProviders />);

    const connect = screen.getByText('settings.cloudAgents.connect').closest('button');
    expect(connect?.disabled).toBe(true);
    expect(screen.getAllByText('settings.cloudAgents.unavailable').length).toBeGreaterThan(0);
  });

  it('keeps a failed Disconnect on screen', () => {
    state.connected = true;
    state.disconnectError = new Error('Couldn’t disconnect');
    render(<CloudAgentProviders />);
    expect(screen.getByRole('alert').textContent).toBe('Couldn’t disconnect');
  });
});
