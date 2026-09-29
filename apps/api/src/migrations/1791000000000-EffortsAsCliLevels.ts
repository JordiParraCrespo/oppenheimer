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
 * Three places hold a launch's effort, and all three are rewritten: the
 * session's projection (`work_session.launchEffort`), the `session.requested`
 * entry it is folded from (a replay of the log must land on the same level),
 * and the automation revision the next run launches from. Revisions are
 * immutable history, but a run started from one thinks as hard as the last.
 *
 * `down()` restores every rewritten value exactly. The mapping alone could not:
 * Codex's `minimal` and `low` both become `low`. So `up()` keeps each original
 * in `effort_level_backup`, keyed by the table and the row it came from, and
 * `down()` puts them back and drops it. A value written after this migration
 * is already in the new vocabulary and is left alone. The table is dropped by
 * the first migration that no longer needs to roll back past this one.
 */
export class EffortsAsCliLevels1791000000000 implements MigrationInterface {
  name = 'EffortsAsCliLevels1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE effort_level_backup (
        source character varying(32) NOT NULL,
        id uuid NOT NULL,
        effort character varying(16) NOT NULL,
        CONSTRAINT "PK_effort_level_backup" PRIMARY KEY (source, id)
      )`,
    );
    const agents = Object.keys(REMAP);
    for (const { source, value, agent, rows } of PLACES) {
      await queryRunner.query(
        `INSERT INTO effort_level_backup (source, id, effort)
         SELECT '${source}', id, ${value} FROM "${source}"
         WHERE ${rows} AND ${agent} = ANY($1) AND ${value} IS NOT NULL`,
        [agents],
      );
    }
    for (const [agent, levels] of Object.entries(REMAP)) {
      const params: string[] = [agent];
      const cases = Object.entries(levels).map(([from, to]) => {
        params.push(from, to);
        return `WHEN $${params.length - 1}::text THEN $${params.length}::text`;
      });
      for (const { source, value, agent: agentOf, rows, set } of PLACES) {
        await queryRunner.query(
          `UPDATE "${source}" SET ${set(`CASE ${value} ${cases.join(' ')} ELSE ${value} END`)}
           WHERE ${rows} AND ${agentOf} = $1 AND ${value} IS NOT NULL`,
          params,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { source, set } of PLACES) {
      await queryRunner.query(
        `UPDATE "${source}" AS target SET ${set('backup.effort')}
         FROM effort_level_backup AS backup
         WHERE backup.source = '${source}' AND backup.id = target.id`,
      );
    }
    await queryRunner.query('DROP TABLE effort_level_backup');
  }
}

/** Each old stop, per agent, as the level it ran at. */
const REMAP: Record<string, Record<string, string>> = {
  'claude-code': { minimal: 'low', low: 'medium', medium: 'high', high: 'xhigh', max: 'max' },
  codex: { minimal: 'low', max: 'xhigh' },
};

/**
 * Where a launch's effort is stored: the expression that reads it, the one that
 * reads the row's agent, which rows of the table carry a launch at all, and the
 * assignment that writes it. The log keeps both inside the `session.requested`
 * payload.
 */
const PLACES: {
  source: string;
  value: string;
  agent: string;
  rows: string;
  set: (expression: string) => string;
}[] = [
  {
    source: 'work_session',
    value: '"launchEffort"',
    agent: 'agent',
    rows: 'TRUE',
    set: (expression) => `"launchEffort" = ${expression}`,
  },
  {
    source: 'automation_revision',
    value: 'effort',
    agent: 'agent',
    rows: 'TRUE',
    set: (expression) => `effort = ${expression}`,
  },
  {
    source: 'work_session_event',
    value: "(payload->'launch'->>'effort')",
    agent: "(payload->>'agent')",
    rows: "kind = 'session.requested'",
    set: (expression) =>
      `payload = jsonb_set(payload, '{launch,effort}', to_jsonb((${expression})::text))`,
  },
];
