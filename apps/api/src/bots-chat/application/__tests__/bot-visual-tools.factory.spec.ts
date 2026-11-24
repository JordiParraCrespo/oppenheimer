/**
 * `show_visual`. What breaks this: a spec that is not a visual reaching the
 * chat (where the console would have to guess), a refusal that does not name
 * the block at fault (so the model cannot fix it), the visual lost on its way
 * to the stored step, or a turn that draws without end.
 */
import { emptyScope } from '@oppenheimer/backend-authz';
import { toVisual } from '../../bot-message.mapper';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { VISUAL_DATA_KEY, VISUALS_PER_TURN } from '../../domain/bot-visual.policy';
import type { BotApprovalRequesterPort } from '../bot-approval-requester.port';
import type { BotToolContext } from '../bot-tool.factory';
import { BotVisualToolsFactory } from '../bot-visual-tools.factory';

function setup() {
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'UTC',
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    approvals: { request: vi.fn<BotApprovalRequesterPort['request']>() },
    budget: new BotTurnBudget(),
    credentialScopes: null,
  };
  const [showVisual] = new BotVisualToolsFactory().definitions();
  const bound = showVisual.bind(context);
  return (input: unknown) => bound.run(input, { signal: new AbortController().signal });
}

const deploys = {
  title: 'Deploys this week',
  blocks: [
    { type: 'metrics', items: [{ label: 'Deploys', value: 38, delta: 6 }] },
    { type: 'bar', labels: ['Mon', 'Tue'], series: [{ label: 'api', values: [4, 7] }] },
  ],
};

describe('BotVisualToolsFactory', () => {
  it('shows a valid visual and carries it, checked, to the stored step', async () => {
    const call = setup();
    const result = await call(deploys);

    expect(result.isError).toBe(false);
    expect(result.content).toContain('"Deploys this week", metrics, bar');
    const stored = toVisual(result.data?.[VISUAL_DATA_KEY]);
    expect(stored?.blocks.map((block) => block.type)).toEqual(['metrics', 'bar']);
  });

  it('refuses a spec that is not a visual, naming each fault by its path', async () => {
    const call = setup();
    const result = await call({
      title: 'Broken',
      blocks: [{ type: 'line', labels: ['a', 'b', 'c'], series: [{ label: 'x', values: [1, 2] }] }],
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('blocks[0].series[0].values: has 2 values for 3 labels');
    expect(result.data?.[VISUAL_DATA_KEY]).toBeUndefined();
  });

  it(`stops a turn at ${VISUALS_PER_TURN} visuals`, async () => {
    const call = setup();
    for (let i = 0; i < VISUALS_PER_TURN; i++) expect((await call(deploys)).isError).toBe(false);
    const over = await call(deploys);
    expect(over.isError).toBe(true);
    expect(over.content).toContain('Answer in words');
  });
});
