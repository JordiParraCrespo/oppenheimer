/**
 * A bot's subscription as an aggregate (`27-bot-subscriptions.md` §3): what
 * a new one may hold, and what recording a wake changes. When it wakes is
 * `bot-subscription.policy.spec.ts`; the stored row's checks are the
 * integration suite's.
 */
import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { BotSubscriptionEntity } from '../domain/bot-subscription.entity';

type SubscribeProps = Parameters<typeof BotSubscriptionEntity.subscribe>[0];

function subscribe(overrides: Partial<SubscribeProps> = {}): BotSubscriptionEntity {
  return BotSubscriptionEntity.subscribe({
    organizationId: 'org-1',
    botId: 'bot-1',
    sessionId: 'session-1',
    originTurnId: 'turn-1',
    purpose: null,
    until: 'task',
    watchedTurn: 1,
    credentialScopes: null,
    timeZone: null,
    known: null,
    ...overrides,
  });
}

describe('BotSubscriptionEntity', () => {
  it('names the task it follows only when it follows one, and drops a blank purpose', () => {
    expect(subscribe({ purpose: '  ' }).purpose).toBeNull();
    expect(subscribe({ until: 'closed', watchedTurn: 4 }).watchedTurn).toBeNull();
    expect(() => subscribe({ watchedTurn: null })).toThrow(ArgumentInvalidException);
    expect(() => subscribe({ watchedTurn: 0 })).toThrow(ArgumentInvalidException);
    expect(() => subscribe({ purpose: 'x'.repeat(501) })).toThrow(ArgumentInvalidException);
  });

  it('starts from the state the bot already knows, with no wakes', () => {
    const subscription = subscribe({ known: { lastTurn: 2, lastState: 'completed' } });
    expect(subscription).toMatchObject({ lastTurn: 2, lastState: 'completed', wakes: 0 });
  });

  it('records each wake as the newest state told, counting it', () => {
    const subscription = subscribe();
    subscription.recordWake(1, 'requires_action');
    subscription.recordWake(1, 'completed');
    expect(subscription.wakeSubject).toMatchObject({
      lastTurn: 1,
      lastState: 'completed',
      wakes: 2,
    });
  });
});
