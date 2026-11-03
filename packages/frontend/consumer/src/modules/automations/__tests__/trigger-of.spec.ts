import type { AutomationTriggerResponseDto } from '@oppenheimer/api-client';
import { describe, expect, it } from 'vitest';
import { triggerOf } from '../automations.repository';

// Regression: a Sentry trigger the API answers read as "none", so the editor
// never shows it and drops it on the next save.
describe('triggerOf', () => {
  const base = { id: 't-1', position: 0, nextFireAt: null };

  it('reads a Sentry trigger with its connection and filter', () => {
    const dto = {
      ...base,
      source: 'sentry',
      event: 'alert_triggered',
      connectionId: 'c-1',
      filter: { op: 'equals', value: 'Errors in production' },
    } as AutomationTriggerResponseDto;
    expect(triggerOf(dto)).toEqual({
      source: 'sentry',
      id: 't-1',
      event: 'alert_triggered',
      connectionId: 'c-1',
      filter: { op: 'equals', value: 'Errors in production' },
    });
  });

  it('reads neither a Sentry event as GitHub’s nor a GitHub event as Sentry’s', () => {
    expect(
      triggerOf({
        ...base,
        source: 'github',
        event: 'issue_created',
      } as AutomationTriggerResponseDto),
    ).toBeNull();
    expect(
      triggerOf({
        ...base,
        source: 'sentry',
        event: 'push',
        connectionId: 'c-1',
      } as AutomationTriggerResponseDto),
    ).toBeNull();
  });
});
