import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Visual } from './visual-card';

/**
 * A visual an agent showed draws as the console's own components, and a spec
 * that is not one never breaks the chat around it. The regressions this
 * guards: a malformed transcript entry throwing inside the chat, a table that
 * stops sorting, and a link that is not http(s) reaching the page.
 */

afterEach(cleanup);

describe('Visual', () => {
  it('draws the title, the figures and the table of a valid spec', () => {
    render(
      <Visual
        spec={{
          title: 'Release health',
          subtitle: 'Last 7 days',
          blocks: [
            { type: 'metrics', items: [{ label: 'Deploys', value: 'twelve' }] },
            {
              type: 'table',
              columns: [{ label: 'Service' }, { label: 'Errors' }],
              rows: [
                ['api', 4],
                ['web', 19],
              ],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Release health')).toBeTruthy();
    expect(screen.getByText('twelve')).toBeTruthy();
    const cells = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent);
    expect(cells()).toEqual(['api4', 'web19']);
    fireEvent.click(screen.getByRole('button', { name: /Errors/ }));
    expect(cells()).toEqual(['web19', 'api4']);
  });

  it('shows a folded note with the faults for a spec that is not a visual', () => {
    const { container } = render(<Visual spec={{ title: 'x', blocks: [{ type: 'pie' }] }} />);
    expect(container.querySelector('[data-slot="visual-invalid"]')).toBeTruthy();
    expect(container.textContent).toMatch(/unknown block type/);
  });

  it('never draws a link that is not http or https', () => {
    const { container } = render(
      <Visual
        spec={{
          title: 'x',
          blocks: [{ type: 'links', items: [{ label: 'x', url: 'javascript:alert(1)' }] }],
        }}
      />,
    );
    expect(container.querySelector('a')).toBeNull();
  });
});
