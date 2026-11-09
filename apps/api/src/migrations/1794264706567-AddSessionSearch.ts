import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot searches every session of its owner's workspace for words
 * (`search_sessions`, `product/versions/mvp/25-bots.md` §4.2): "where did I
 * work on the auth bug?", on any host. What it searches is what Postgres
 * holds: the session's name and the human-readable text of its log. The
 * agent's own transcript lives on the host and is not searched here.
 *
 * - `work_session_event_search_vector(kind, payload)`: the words of one log
 *   entry, by kind, from the payload fields a person or an agent wrote (the
 *   task and follow-ups, a turn's result, a failure's detail, a new name, the
 *   agent's notices, its status title and message, its questions and their
 *   options, a shared file's name and caption, a wake's note). Ids, hashes,
 *   senders and JSON keys are left out. `jsonb_to_tsvector(… '["string"]')`
 *   takes string values only, so a field holding something else adds no
 *   words. `IMMUTABLE` holds: every call in it is (`jsonb_path_query_array`
 *   without `_tz`, `jsonb_to_tsvector` with a configuration). Its TypeScript
 *   twin, which picks the snippet's text, is `SESSION_SEARCH_FIELDS` in
 *   `sessions/domain/session-search.policy.ts`; a spec holds the two lists of
 *   kinds equal.
 * - `IDX_work_session_event_search`: GIN over that function, partial on the
 *   kinds it reads, so the many entries with no words (`agent.observed`
 *   without a report is most of them, but it is in the list for the report)
 *   are kept out of it as far as the kind allows.
 * - `IDX_work_session_name_search`: GIN over `to_tsvector('simple', "name")`.
 *   A rename is rare, so it costs the row's frequent fold updates nothing
 *   (they stay HOT: `name` is the only column it names).
 *
 * `simple` assumes no language, as `IDX_bot_message_search` does: a session
 * named in Spanish matches word for word, with no stemming.
 *
 * Access patterns and the indexes that serve them:
 *   Q1 the log entries of the caller's sessions whose words match
 *      → IDX_work_session_event_search, with the sessions by
 *        IDX_work_session_event_session_seq
 *   Q2 the caller's sessions whose name matches → IDX_work_session_name_search,
 *      ANDed with UQ_work_session_organization_slug for the workspace
 *
 * `work_session_event` has no `"organizationId"` (its header says why), so the
 * tenant cannot lead the GIN index: the query narrows to the caller's
 * sessions through the scoped `work_session` read, and the planner joins the
 * two. A `btree_gin` index leading with `"sessionId"` is the next step if one
 * word across every tenant ever makes Q1 slow.
 *
 * The query repeats the function call and the kind list exactly, or the
 * planner cannot use the index. Closed (resolved) sessions are searched like
 * any other; a session row is deleted only with its workspace, and its log
 * with it.
 *
 * Plain `CREATE INDEX`, not `CONCURRENTLY`: migrations run at boot in one
 * transaction, and no deployment holds sessions anyone needs yet
 * (`database-design.md`, "While nothing is deployed").
 */
export class AddSessionSearch1794264706567 implements MigrationInterface {
  name = 'AddSessionSearch1794264706567';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION work_session_event_search_vector(kind text, payload jsonb)
        RETURNS tsvector
        LANGUAGE sql IMMUTABLE PARALLEL SAFE
        RETURN jsonb_to_tsvector(
          'simple'::regconfig,
          CASE kind
            WHEN 'prompt.first' THEN jsonb_path_query_array(payload, '$.text')
            WHEN 'prompt.sent' THEN jsonb_path_query_array(payload, '$.text')
            WHEN 'turn.requested' THEN jsonb_path_query_array(payload, '$.prompt')
            WHEN 'turn.ended' THEN jsonb_path_query_array(payload, '$.result')
            WHEN 'session.failed' THEN jsonb_path_query_array(payload, '$.detail')
            WHEN 'session.named' THEN jsonb_path_query_array(payload, '$.name')
            WHEN 'agent.notified' THEN jsonb_path_query_array(payload, '$.text')
            WHEN 'wake.requested' THEN jsonb_path_query_array(payload, '$.text')
            WHEN 'file.shared' THEN
              jsonb_path_query_array(payload, '$.name')
              || jsonb_path_query_array(payload, '$.caption')
            WHEN 'agent.observed' THEN
              jsonb_path_query_array(payload, '$.program.title')
              || jsonb_path_query_array(payload, '$.program.message')
            WHEN 'agent.decision' THEN
              jsonb_path_query_array(payload, '$.decision.title')
              || jsonb_path_query_array(payload, '$.decision.detail')
              || jsonb_path_query_array(payload, '$.decision.questions[*].header')
              || jsonb_path_query_array(payload, '$.decision.questions[*].question')
              || jsonb_path_query_array(payload, '$.decision.questions[*].options[*].label')
              || jsonb_path_query_array(payload, '$.decision.questions[*].options[*].description')
              || jsonb_path_query_array(payload, '$.decision.options[*].label')
            ELSE '[]'::jsonb
          END,
          '["string"]'::jsonb
        )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_work_session_event_search" ON "work_session_event"
        USING GIN (work_session_event_search_vector("kind", "payload"))
        WHERE "kind" IN ('prompt.first', 'prompt.sent', 'turn.requested', 'turn.ended',
                         'session.failed', 'session.named', 'agent.notified', 'wake.requested',
                         'file.shared', 'agent.observed', 'agent.decision')
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_work_session_name_search" ON "work_session"
        USING GIN (to_tsvector('simple', "name"))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_work_session_name_search"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_work_session_event_search"`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS work_session_event_search_vector(text, jsonb)`,
    );
  }
}
