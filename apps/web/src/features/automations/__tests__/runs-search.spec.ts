import { describe, expect, it } from 'vitest';
import { runLocation } from '../lib/run-location';
import { runsSearchSchema } from '../lib/runs-search';

/**
 * The runs list lives in the URL, so a filtered list is a link someone can
 * send. A value the schema does not accept reads as absent (the default), never
 * as an error that fails the route.
 */
describe('runsSearchSchema', () => {
  it('keeps every facet and the page', () => {
    expect(
      runsSearchSchema.parse({
        status: 'failed',
        automation: 'a1',
        project: 'p1',
        window: '7d',
        page: '3',
      }),
    ).toEqual({ status: 'failed', automation: 'a1', project: 'p1', window: '7d', page: 3 });
  });

  it('reads a value it does not accept as absent', () => {
    expect(
      runsSearchSchema.parse({ status: 'exploded', window: '1y', page: '0', automation: '' }),
    ).toEqual({
      status: undefined,
      automation: undefined,
      project: undefined,
      window: undefined,
      page: undefined,
    });
  });
});

describe('runLocation', () => {
  it("opens a started run's session beside the automations list", () => {
    expect(runLocation({ automationId: 'a1', sessionId: 's1' })).toEqual({
      to: '/automations/$automationId/sessions/$sessionId',
      params: { automationId: 'a1', sessionId: 's1' },
    });
  });

  it('opens the Runs tab for a run that has no session yet', () => {
    expect(runLocation({ automationId: 'a1', sessionId: null })).toEqual({
      to: '/automations/runs',
    });
  });
});
