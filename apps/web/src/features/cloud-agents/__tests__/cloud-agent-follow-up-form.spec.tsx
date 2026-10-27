import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudAgentFollowUpForm } from '../forms/cloud-agent-follow-up-form';

/**
 * An agent's next instruction. What breaks this: a send offered while the
 * run is still going (the vendor refuses it, CLOUD_AGENTS_008), or an empty
 * instruction sent to the vendor.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@oppenheimer/frontend-web', () => ({
  useZodResolver:
    (schema: { safeParse: (values: unknown) => { success: boolean } }) => async (values: unknown) =>
      schema.safeParse(values).success
        ? { values, errors: {} }
        : { values: {}, errors: { prompt: { type: 'too_small', message: 'required' } } },
}));

afterEach(cleanup);

describe('CloudAgentFollowUpForm', () => {
  it('is off while the run is going, and says why', () => {
    render(
      <CloudAgentFollowUpForm
        disabledReason="once this run ends"
        pending={false}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText('once this run ends')).toBeTruthy();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true);
    expect(screen.getByText('sessions.cloudAgents.detail.send').closest('button')?.disabled).toBe(
      true,
    );
  });

  it('hands the instruction up, and refuses an empty one', async () => {
    const onSubmit = vi.fn();
    render(<CloudAgentFollowUpForm pending={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByText('sessions.cloudAgents.detail.send'));
    await waitFor(() =>
      expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true'),
    );
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Add a test for it.' } });
    fireEvent.click(screen.getByText('sessions.cloudAgents.detail.send'));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Add a test for it.'));
  });
});
