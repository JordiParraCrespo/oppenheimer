import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HostInstallInstruction } from './install-instruction';

/**
 * The install instruction Add a host shows twice — Settings' page and the
 * console's dialog. One panel, two ways to read it, and the installer's
 * digest only under the command it verifies.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { digest?: string }) =>
      options?.digest === undefined ? key : `${key} ${options.digest}`,
  }),
}));

afterEach(cleanup);

const INSTRUCTION = {
  installCommand: 'curl -fsSL https://example.test/install.sh | sh',
  agentPrompt: 'You are setting up this machine as an Oppenheimer host.',
  installScriptSha256: 'abc123',
};

describe('HostInstallInstruction', () => {
  it('holds its place until the token is minted', () => {
    const { container } = render(<HostInstallInstruction instruction={null} />);
    expect(container.querySelector('[data-slot="code-block"]')).toBeNull();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it('opens on the command, with the digest under it', () => {
    render(<HostInstallInstruction instruction={INSTRUCTION} />);
    expect(screen.getByText(INSTRUCTION.installCommand)).toBeDefined();
    expect(screen.getByText('hosts.pairing.installerDigest abc123')).toBeDefined();
  });

  it('switches to the agent prompt, which carries no digest', () => {
    render(<HostInstallInstruction instruction={INSTRUCTION} />);
    fireEvent.click(screen.getByRole('tab', { name: 'hosts.add.install.agentPrompt' }));
    expect(screen.getByText(INSTRUCTION.agentPrompt)).toBeDefined();
    expect(screen.queryByText(INSTRUCTION.installCommand)).toBeNull();
    expect(screen.queryByText('hosts.pairing.installerDigest abc123')).toBeNull();
  });
});
