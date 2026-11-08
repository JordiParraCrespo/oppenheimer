/**
 * A bot's heartbeat (`26-bot-routines.md` §6): what breaks this is a trigger
 * the routine save refuses (so no bot gets one), every bot of a workspace
 * waking on the same minute, a minute that moves between replicas or
 * retries, a redelivered creation saving a second heartbeat, and a prompt
 * that no longer tells a beat with nothing to say to stay quiet. That the
 * listener saves it is `bot-heartbeat.domain-event-handler.spec.ts`.
 */
import { randomUUID } from 'node:crypto';
import { scheduleTriggerInputSchema } from '@oppenheimer/shared';
import {
  HEARTBEAT_NAME,
  HEARTBEAT_PROMPT,
  heartbeatMinute,
  heartbeatTrigger,
  needsHeartbeat,
} from '../domain/bot-heartbeat.policy';

describe('bot heartbeat', () => {
  it('is an hourly schedule the routine save accepts', () => {
    const trigger = heartbeatTrigger('bot-1');
    expect(scheduleTriggerInputSchema.safeParse(trigger).success).toBe(true);
    expect(trigger).toMatchObject({ source: 'schedule', frequency: 'hourly' });
  });

  it('beats on the same minute for the same bot, every time it is asked', () => {
    const botId = randomUUID();
    expect(heartbeatMinute(botId)).toBe(heartbeatMinute(botId));
    expect(heartbeatTrigger(botId).minute).toBe(heartbeatMinute(botId));
  });

  it("spreads a workspace's bots across the hour instead of waking them all at :00", () => {
    const minutes = Array.from({ length: 200 }, () => heartbeatMinute(randomUUID()));
    expect(minutes.every((minute) => Number.isInteger(minute) && minute >= 0 && minute < 60)).toBe(
      true,
    );
    expect(new Set(minutes).size).toBeGreaterThan(30);
  });

  it('is owed only to a bot that has no routine by its name', () => {
    expect(needsHeartbeat([])).toBe(true);
    expect(needsHeartbeat(['Morning PR review'])).toBe(true);
    expect(needsHeartbeat(['Morning PR review', HEARTBEAT_NAME])).toBe(false);
  });

  it('tells a beat with nothing to say to end quietly, and one with news to notify', () => {
    expect(HEARTBEAT_PROMPT).toContain('nothing_to_report');
    expect(HEARTBEAT_PROMPT).toContain('notify');
  });
});
