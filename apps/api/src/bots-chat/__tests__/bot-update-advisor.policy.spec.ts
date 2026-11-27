/**
 * How `update_bot` sets a bot's advisor (`planBotUpdate`). What breaks this:
 * an advisor the bot's model does not take passed on for the API to drop
 * without a word, so the bot reports a change that never happened; a label
 * ("Opus 5.5") refused although the tool says it takes one; or a model change
 * in the same call checked against the old model.
 */
import { randomUUID } from 'node:crypto';
import { BotEntity } from '../../bots/domain/bot.entity';
import { planBotUpdate } from '../application/bot-update.policy';

function bot(model: string) {
  return BotEntity.createNew({
    organizationId: randomUUID(),
    createdByUserId: randomUUID(),
    name: 'Juno',
    description: '',
    avatarColor: 'mint',
    groupId: null,
    homeHostId: null,
    provider: 'anthropic',
    model,
  });
}

const plan = (target: BotEntity, input: Record<string, unknown>) =>
  planBotUpdate({ bot_ids: [target.id], ...input }, target, [target], ['anthropic'], []);

describe("update_bot's advisor", () => {
  it('takes an advisor by id or by label, and null turns it off', () => {
    const sonnet = bot('claude-sonnet-5-5');
    for (const asked of ['claude-opus-5-5', 'Opus 5.5', 'opus 5.5']) {
      expect(plan(sonnet, { advisor_model: asked })).toMatchObject({
        steps: [{ body: { advisorModel: 'claude-opus-5-5' } }],
      });
    }
    expect(plan(sonnet, { advisor_model: null })).toMatchObject({
      steps: [{ body: { advisorModel: null } }],
    });
  });

  it('refuses one the model does not take, naming the ones it does', () => {
    const refused = plan(bot('claude-sonnet-5-5'), { advisor_model: 'Opus 4.8' });
    expect(refused).toHaveProperty('refusal');
    expect((refused as { refusal: string }).refusal).toContain('Opus 5.5');
    const none = plan(bot('claude-fable-5-2'), { advisor_model: 'claude-opus-5-5' });
    expect((none as { refusal: string }).refusal).toContain('It takes no advisor.');
  });

  it('checks it against the model the same call moves to', () => {
    expect(
      plan(bot('claude-fable-5-2'), { model: 'claude-sonnet-5-5', advisor_model: 'Opus 5.5' }),
    ).toMatchObject({
      steps: [{ body: { model: 'claude-sonnet-5-5', advisorModel: 'claude-opus-5-5' } }],
    });
  });

  it('leaves the advisor alone when the call does not name it', () => {
    const steps = (
      plan(bot('claude-sonnet-5-5'), { effort: 'low' }) as { steps: { body: object }[] }
    ).steps;
    expect(steps[0]?.body).not.toHaveProperty('advisorModel');
  });
});
