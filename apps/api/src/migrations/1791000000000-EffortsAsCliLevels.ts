import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Effort stored under each CLI's own level names, rewritten to what already ran.
 *
 * Until now a stored effort was one of five product stops (`minimal` … `max`)
 * that each agent's catalog entry mapped onto its CLI; from here on it is the
 * level the CLI was started at, under the CLI's name
 * (`packages/shared/src/agents/catalog.ts`, `SESSION_EFFORTS`). The rows keep
 * meaning what they ran, so each is rewritten through the old mapping:
 *
 * - Claude Code shifted every stop one level up (Minimal ran `--effort low`,
 *   Medium ran `high`, High ran `xhigh`), and Max ran `max`.
 * - Codex's Max ran `xhigh`. Its Minimal ran `minimal`, which no Codex model
 *   takes; `low` is the lowest level one does, and the nearest it could have
 *   meant.
 * - Grok's stops were its levels of the same names, and OpenCode took none, so
 *   neither has a row to change.
 *
 * Both columns are free text, so no constraint changes. Automation revisions
 * are immutable history, but a revision is also what the next run launches
 * from, so it is rewritten like a session: the run it starts thinks as hard as
 * the last one did.
 */
export class EffortsAsCliLevels1791000000000 implements MigrationInterface {
  name = 'EffortsAsCliLevels1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await remap(queryRunner, UP);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await remap(queryRunner, DOWN);
  }
}

type Remap = Record<string, Record<string, string>>;

const UP: Remap = {
  'claude-code': { minimal: 'low', low: 'medium', medium: 'high', high: 'xhigh', max: 'max' },
  codex: { minimal: 'low', max: 'xhigh' },
};

// Back to the stops, through the same mapping read the other way. A level the
// stops had no way to ask for (Claude's `max` apart, Codex's `ultra`) goes to
// the nearest stop; Codex's `minimal` does not come back, because it never ran.
const DOWN: Remap = {
  'claude-code': { low: 'minimal', medium: 'low', high: 'medium', xhigh: 'high', max: 'max' },
  codex: { xhigh: 'max', max: 'max', ultra: 'max' },
};

/**
 * One `UPDATE` per table, every value at once through a `CASE`, so a value
 * rewritten into another's old name (Claude's `low` becoming `medium`) is not
 * rewritten a second time.
 */
async function remap(queryRunner: QueryRunner, mapping: Remap): Promise<void> {
  for (const [table, column] of [
    ['work_session', 'launchEffort'],
    ['automation_revision', 'effort'],
  ] as const) {
    for (const [agent, levels] of Object.entries(mapping)) {
      const params: string[] = [agent];
      const cases = Object.entries(levels).map(([from, to]) => {
        params.push(from, to);
        return `WHEN $${params.length - 1} THEN $${params.length}`;
      });
      await queryRunner.query(
        `UPDATE "${table}" SET "${column}" = CASE "${column}" ${cases.join(' ')} ELSE "${column}" END
         WHERE agent = $1 AND "${column}" IS NOT NULL`,
        params,
      );
    }
  }
}
