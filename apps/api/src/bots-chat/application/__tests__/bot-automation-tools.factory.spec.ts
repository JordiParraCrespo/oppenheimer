import type { QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '../../../authz/domain/access-scope.types';
import { FindAutomationQuery } from '../../../automations/queries/find-automation/find-automation.query';
import { FindAutomationRunsQuery } from '../../../automations/queries/find-automation-runs/find-automation-runs.query';
import { FindAutomationsQuery } from '../../../automations/queries/find-automations/find-automations.query';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotAutomationToolsFactory } from '../bot-automation-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * The automation tools a bot reads through: each dispatches the automations
 * module's own query in the owner's scope and answers labelled text with ids
 * inline, "none" in words, and a run's status kept apart from its test
 * results, which only the session's result can tell. The queries themselves
 * are the automations module's specs.
 */
const owner = emptyScope('owner-1', 'org-1');
const context: BotToolContext = {
  owner,
  organizationId: 'org-1',
  botId: 'bot-1',
  turnId: 'turn-1',
  homeHostId: null,
  timeZone: 'Europe/Madrid',
  permission: 'auto',
  permissions: NO_PERMISSIONS,
  budget: new BotTurnBudget(),
  credentialScopes: null,
  approvals: { request: vi.fn() },
};

const AUTOMATION = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';
const SESSION = '33333333-3333-4333-8333-333333333333';

function setup(answer: (query: unknown) => unknown) {
  const queryBus = { execute: vi.fn(async (query: unknown) => answer(query)) };
  const factory = new BotAutomationToolsFactory(queryBus as unknown as QueryBus);
  const call = (name: string, input: unknown) => {
    const found = factory.definitions().find((definition) => definition.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    return found.bind(context).run(input, { signal: new AbortController().signal });
  };
  return { queryBus, call };
}

const automation = {
  id: AUTOMATION,
  name: 'Nightly tests',
  isPaused: false,
  pausedReason: null,
  overlap: 'skip',
  maxRunsPerHour: null,
  get target() {
    return { kind: 'session', projectId: PROJECT, revision: this.revision };
  },
  revision: {
    number: 3,
    place: 'host',
    hostId: 'host-1',
    agent: 'claude',
    model: null,
    permission: 'auto',
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    effort: null,
    prompt: 'Run the test suite and report.',
    repositories: [{ installationId: 'inst-1', githubRepoId: '7', fullName: 'acme/api' }],
    createdAt: new Date('2026-10-01T08:00:00Z'),
  },
  triggers: [
    {
      id: 't-1',
      position: 0,
      source: 'schedule',
      eventType: 'schedule',
      config: { frequency: 'daily', hour: 2, minute: 30 },
      timezone: 'Europe/Madrid',
      nextFireAt: new Date('2026-10-16T00:30:00Z'),
    },
    {
      id: 't-2',
      position: 1,
      source: 'github',
      eventType: 'pull_request.opened',
      config: { repositories: ['acme/api'], filter: { op: 'any' } },
      timezone: null,
      nextFireAt: null,
    },
  ],
};

const run = (overrides: Record<string, unknown> = {}) => ({
  id: 'run-1',
  automationId: AUTOMATION,
  automationName: 'Nightly tests',
  automationDeleted: false,
  projectId: PROJECT,
  status: 'completed',
  outcome: 'dispatched',
  skipReason: null,
  cause: 'schedule',
  causeSummary: { label: 'Schedule', text: 'Daily run', eventType: 'schedule' },
  sessionId: SESSION,
  branch: 'auto/nightly-1',
  createdAt: new Date('2026-10-15T00:30:00Z'),
  scheduledFor: new Date('2026-10-15T00:30:00Z'),
  turn: { exitCode: 0 },
  ...overrides,
});

describe('BotAutomationToolsFactory', () => {
  it('lists the owner’s automations of a project with their triggers and last run', async () => {
    const { queryBus, call } = setup(() => ({
      automations: [automation],
      digests: new Map([[AUTOMATION, { running: false, runCount: 4, lastRuns: [run()] }]]),
    }));

    const result = await call('list_automations', { project_id: PROJECT });

    const query = queryBus.execute.mock.calls[0][0] as FindAutomationsQuery;
    expect(query).toBeInstanceOf(FindAutomationsQuery);
    expect(query).toMatchObject({ scope: owner, projectId: PROJECT });
    expect(result.content).toContain(`${AUTOMATION} "Nightly tests" [active; project ${PROJECT}`);
    expect(result.content).toContain(
      'schedule daily at 02:30 Europe/Madrid, next 16 Oct 2026, 02:30',
    );
    expect(result.content).toContain('github pull_request.opened on acme/api');
    expect(result.content).toContain('last run completed 15 Oct 2026, 02:30');
  });

  it('says in words that there are no automations, rather than an empty list', async () => {
    const { call } = setup(() => ({ automations: [], digests: new Map() }));
    expect((await call('list_automations', {})).content).toContain(
      'The workspace has no automations',
    );
  });

  it('reads one automation in the owner’s scope with its settings, prompt and recent runs', async () => {
    const { queryBus, call } = setup(() => ({
      automation,
      digest: { running: true, runCount: 1, lastRuns: [run()] },
    }));

    const result = await call('get_automation', { automation_id: AUTOMATION });

    const query = queryBus.execute.mock.calls[0][0] as FindAutomationQuery;
    expect(query).toBeInstanceOf(FindAutomationQuery);
    expect(query).toMatchObject({ scope: owner, automationId: AUTOMATION });
    expect(result.content).toContain('- runs on: host host-1; agent claude; permission auto');
    expect(result.content).toContain('- repositories: acme/api');
    expect(result.content).toContain('Prompt:\nRun the test suite and report.');
    expect(result.content).toContain('Runs: 1 in the last 30 days, one live now.');
  });

  it('lists runs with cause, status, time in the sender’s zone and session, and keeps status apart from test results', async () => {
    const { queryBus, call } = setup(() => ({
      items: [
        run(),
        run({
          id: 'run-2',
          status: 'skipped',
          outcome: 'skipped',
          skipReason: 'overlapping',
          sessionId: null,
          branch: null,
          cause: 'event',
          causeSummary: {
            label: 'Pull request opened',
            text: 'Add login',
            ref: 'acme/api#12',
            eventType: 'pull_request.opened',
          },
        }),
      ],
      total: 2,
      counts: { all: 2, completed: 1, failed: 0, running: 0 },
    }));

    const result = await call('run_history', {
      automation_id: AUTOMATION,
      status: ['completed', 'skipped'],
      window: '24h',
    });

    const query = queryBus.execute.mock.calls[0][0] as FindAutomationRunsQuery;
    expect(query).toBeInstanceOf(FindAutomationRunsQuery);
    expect(query.scope).toBe(owner);
    expect(query.filters).toEqual({
      automationId: AUTOMATION,
      projectId: undefined,
      status: ['completed', 'skipped'],
      window: '24h',
      page: 1,
      limit: 10,
    });
    expect(result.content).toContain(
      `run run-1 of ${AUTOMATION} "Nightly tests" [cause: schedule, Schedule; status completed; at 15 Oct 2026, 02:30; session ${SESSION} on branch auto/nightly-1]`,
    );
    expect(result.content).toContain(
      'cause: event, Pull request opened acme/api#12; status skipped (overlapping)',
    );
    expect(result.content).toContain('no session started');
    expect(result.content).toContain(
      "test results are not known unless the session's result says so",
    );
  });

  it('answers bad input as an error the model can correct, dispatching nothing', async () => {
    const { queryBus, call } = setup(() => ({ items: [], total: 0, counts: {} }));
    const result = await call('run_history', { window: '1y', limit: 500 });
    expect(result.isError).toBe(true);
    expect(result.content).toMatch(/^Invalid input: /);
    expect(result.content).toContain('window');
    expect(queryBus.execute).not.toHaveBeenCalled();
  });
});
