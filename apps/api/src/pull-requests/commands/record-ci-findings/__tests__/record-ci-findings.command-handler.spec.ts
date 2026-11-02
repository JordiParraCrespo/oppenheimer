import type { AccessScope } from '@oppenheimer/backend-authz';
import { describe, expect, it, vi } from 'vitest';
import type { PullRequestReadPort } from '../../../../github/application/pull-request-read.port';
import type { CiFindingRepositoryPort } from '../../../database/ci-finding.repository.port';
import type { CiFindingEntity } from '../../../domain/ci-finding.entity';
import { type CiFindingInput, RecordCiFindingsCommand } from '../record-ci-findings.command';
import { RecordCiFindingsCommandHandler } from '../record-ci-findings.command-handler';

/**
 * Filing what failing checks came to (`0.2-pull-requests.md`, "CI
 * findings"): read as the caller, filed on the head GitHub shows now, and
 * only for a check failing there. A finding about a passing check, or with
 * the checks unreadable, is refused and nothing is written. The upsert that
 * replaces a second look is the integration suite's.
 */
const SCOPE: AccessScope = {
  userId: 'user-1',
  organizationId: 'org-acme',
  teamIds: [],
  grants: new Map(),
  bypass: false,
};
const ADDRESS = {
  kind: 'installation' as const,
  installationId: 'inst-1',
  githubRepoId: 42,
  number: 14,
};
const HEAD = 'abc1234def5678';

const finding = (check: string): CiFindingInput => ({
  check,
  rootCause: 'The parser rejects an empty date.',
  relation: 'this_change',
  flake: 'real',
  action: 'fix_here',
  next: 'Accept an empty date in parseDate.',
  confidence: 'high',
  evidence: ['src/date.ts:12 throws on ""'],
});

function setup(checks: { value: unknown; refusal: string | null }) {
  const access = {
    pullRequest: vi.fn().mockResolvedValue({ pull: { headSha: HEAD }, checks }),
  } satisfies Pick<PullRequestReadPort, 'pullRequest'>;
  const findings = {
    record: vi.fn(async (_findings: readonly CiFindingEntity[]) => {}),
    findForHead: vi.fn(),
  } satisfies CiFindingRepositoryPort;
  const handler = new RecordCiFindingsCommandHandler(
    access as unknown as PullRequestReadPort,
    findings,
  );
  const run = (...checksFound: string[]) =>
    handler.execute(
      new RecordCiFindingsCommand({
        scope: SCOPE,
        address: ADDRESS,
        findings: checksFound.map(finding),
        botId: 'bot-1',
      }),
    );
  return { access, findings, run };
}

const failing = (...names: string[]) => ({
  value: {
    state: 'failing',
    total: 3,
    passed: 3 - names.length,
    failed: names.length,
    pending: 0,
    failing: names.map((name) => ({ name, url: null, title: null, summary: null })),
  },
  refusal: null,
});

describe('RecordCiFindingsCommandHandler', () => {
  it('files a finding per failing check on the head GitHub shows, as the caller and their bot', async () => {
    const { access, findings, run } = setup(failing('unit', 'lint'));
    expect(await run('unit', 'lint')).toBe(HEAD);
    expect(access.pullRequest).toHaveBeenCalledWith(SCOPE, ADDRESS);
    const filed = findings.record.mock.calls[0]?.[0] ?? [];
    expect(filed.map((entity) => entity.getProps())).toEqual([
      expect.objectContaining({
        organizationId: 'org-acme',
        githubRepoId: 42,
        number: 14,
        headSha: HEAD,
        check: 'unit',
        recordedByUserId: 'user-1',
        recordedByBotId: 'bot-1',
      }),
      expect.objectContaining({ check: 'lint' }),
    ]);
  });

  it('refuses a check that is not failing on the head with PULLS_003, naming what is, and files nothing', async () => {
    const { findings, run } = setup(failing('unit'));
    await expect(run('unit', 'e2e')).rejects.toMatchObject({
      code: 'PULLS_003',
      detail: 'Not failing on abc1234: e2e. Failing: unit',
    });
    expect(findings.record).not.toHaveBeenCalled();
  });

  it('refuses with PULLS_004 when GitHub would not show the checks', async () => {
    const { findings, run } = setup({ value: null, refusal: 'forbidden' });
    await expect(run('unit')).rejects.toMatchObject({ code: 'PULLS_004' });
    expect(findings.record).not.toHaveBeenCalled();
  });
});
