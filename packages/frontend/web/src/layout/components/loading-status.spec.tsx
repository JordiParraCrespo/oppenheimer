import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingAnnouncer, LoadingStatus } from './loading-status';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

describe('LoadingAnnouncer', () => {
  it('says "Loading…" once however many placeholders are on screen', () => {
    // The regression: each placeholder carried its own status, so a page
    // drawing a sidebar and a pane at once was read out twice.
    render(
      <LoadingAnnouncer>
        <LoadingStatus />
        <LoadingStatus />
      </LoadingAnnouncer>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toBe('common.loading');
  });

  it('stays a live region a modal dialog leaves heard', () => {
    // A modal hides everything outside it but `[aria-live]` from assistive
    // technology; with only the implicit role, a placeholder in a dialog went silent.
    render(
      <LoadingAnnouncer>
        <LoadingStatus />
      </LoadingAnnouncer>,
    );
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });

  it('goes quiet when the last placeholder leaves', () => {
    const { rerender } = render(
      <LoadingAnnouncer>
        <LoadingStatus />
      </LoadingAnnouncer>,
    );
    rerender(<LoadingAnnouncer>{null}</LoadingAnnouncer>);
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('is its own status outside an announcer', () => {
    render(<LoadingStatus />);
    expect(screen.getByRole('status').textContent).toBe('common.loading');
  });
});
