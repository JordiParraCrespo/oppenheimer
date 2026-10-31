import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { MilestoneOrmEntity } from '../database/milestone.orm-entity';
import { MilestoneRepository } from '../database/milestone.repository';
import { PlanEventOrmEntity } from '../database/plan-event.orm-entity';
import { PlanEventRepository } from '../database/plan-event.repository';
import { TaskOrmEntity } from '../database/task.orm-entity';
import { TaskRepository } from '../database/task.repository';
import { TaskSessionOrmEntity } from '../database/task-session.orm-entity';
import { MilestoneEntity } from '../domain/milestone.entity';
import { type PlanActor, userActor } from '../domain/plan-change.types';
import { TaskEntity } from '../domain/task.entity';
import { MilestoneMapper } from '../milestone.mapper';
import { PlanEventMapper } from '../plan-event.mapper';
import { TaskMapper } from '../task.mapper';

/**
 * Plan's board against a real Postgres (`product/versions/mvp/19-plan-tasks-and-goals.md`):
 * the order a column keeps under concurrent moves, the one milestone key and what it carries,
 * and the attach rule's lock. The schema is the migrations', so a wrong key fails here.
 */
describe('tasks: the board (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let tasks: TaskRepository;
  let milestones: MilestoneRepository;
  let planEvents: PlanEventRepository;
  let organizationId: string;
  let userId: string;
  let projectId: string;
  let otherProjectId: string;

  const scope = (): AccessScope => ({
    userId,
    organizationId,
    teamIds: [],
    grants: new Map(),
    bypass: false,
  });

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_USER: 'test', POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
    process.env.DB_HOST = pg.getHost();
    process.env.DB_PORT = pg.getMappedPort(5432).toString();
    await runAllMigrations();

    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: 'test',
      password: 'test',
      database: 'test',
      entities: [
        TaskOrmEntity,
        MilestoneOrmEntity,
        TaskSessionOrmEntity,
        PlanEventOrmEntity,
        OutboxMessageSchema,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    const outbox = new OutboxService(dataSource);
    const events = new PlanEventMapper();
    tasks = new TaskRepository(
      dataSource.getRepository(TaskOrmEntity),
      new TaskMapper(),
      events,
      outbox,
    );
    milestones = new MilestoneRepository(
      dataSource.getRepository(MilestoneOrmEntity),
      new MilestoneMapper(),
      events,
      outbox,
    );
    planEvents = new PlanEventRepository(dataSource.getRepository(PlanEventOrmEntity));
  }, 180000);

  afterAll(async () => {
    await dataSource?.destroy();
    await pg?.stop();
  });

  beforeEach(async () => {
    organizationId = randomUUID();
    userId = randomUUID();
    await dataSource.query(
      `INSERT INTO "organization" ("id", "name", "slug") VALUES ($1, 'Acme', $2)`,
      [organizationId, `acme-${organizationId.slice(0, 8)}`],
    );
    await dataSource.query(
      `INSERT INTO "user" ("id", "name", "email", "firstName", "lastName")
       VALUES ($1, 'Ana', $2, 'Ana', 'Díaz')`,
      [userId, `${userId}@example.com`],
    );
    projectId = await insertProject('mobile');
    otherProjectId = await insertProject('atlas');
  });

  async function insertProject(slug: string): Promise<string> {
    const [row] = await dataSource.query(
      `INSERT INTO "project" ("organizationId", "name", "slug") VALUES ($1, $2, $2) RETURNING "id"`,
      [organizationId, slug],
    );
    return row.id;
  }

  async function insertSession(): Promise<string> {
    const hostId = randomUUID();
    await dataSource.query(
      `INSERT INTO "host" ("id", "ownerUserId", "name", "publicKey", "publicKeyFingerprint")
       VALUES ($1, $2, 'devbox', 'key', $3)`,
      [hostId, userId, randomUUID()],
    );
    const [row] = await dataSource.query(
      `INSERT INTO "work_session" ("organizationId", "projectId", "createdByUserId", "hostId", "name", "slug", "agent")
       VALUES ($1, $2, $3, $4, 'work', $5, 'claude-code') RETURNING "id"`,
      [organizationId, projectId, userId, hostId, `s-${randomUUID().slice(0, 8)}`],
    );
    return row.id;
  }

  async function add(
    title: string,
    status: TaskEntity['status'] = 'todo',
    milestoneId: string | null = null,
  ) {
    const task = TaskEntity.createNew({
      organizationId,
      projectId,
      milestoneId,
      status,
      title,
      createdByUserId: userId,
      actor: userActor(userId),
    });
    expect(await tasks.insert(task, { status, after: { kind: 'last' } })).toBe('placed');
    return task;
  }

  /** A fresh read, as the next request would make it, acting as `actor`. */
  async function reload(id: string, actor: PlanActor = userActor(userId)) {
    return (await tasks.findOneById(scope(), id)).unwrap().actingAs(actor);
  }

  async function eventsOf(subjectId: string) {
    return dataSource.query(
      `SELECT kind, "actorType", "actorUserId", "actorAgentId", payload
         FROM plan_event WHERE "subjectId" = $1 ORDER BY "occurredAt", kind`,
      [subjectId],
    ) as Promise<
      {
        kind: string;
        actorType: string;
        actorUserId: string | null;
        actorAgentId: string | null;
        payload: Record<string, unknown>;
      }[]
    >;
  }

  const column = async (status: TaskEntity['status']) =>
    (await tasks.findAll(scope(), {})).filter((t) => t.status === status).map((t) => t.title);

  it('keeps the order a person drops cards in, first, last and between two others', async () => {
    const a = await add('a');
    const b = await add('b');
    const c = await add('c');
    await tasks.move(c, { status: 'todo', after: { kind: 'first' } });
    expect(await column('todo')).toEqual(['c', 'a', 'b']);
    await tasks.move(c, { status: 'todo', after: { kind: 'task', taskId: a.id } });
    expect(await column('todo')).toEqual(['a', 'c', 'b']);
    await tasks.move(a, { status: 'doing', after: { kind: 'first' } });
    expect(await column('todo')).toEqual(['c', 'b']);
    expect(await column('doing')).toEqual(['a']);
    expect((await tasks.findOneById(scope(), b.id)).unwrap().rank).toBe(b.rank);
  });

  it('places both of two concurrent drops into the same gap, one after the other', async () => {
    const a = await add('a');
    await add('b');
    const x = await add('x', 'later');
    const y = await add('y', 'later');
    // Both read the same neighbours; the one that loses on UQ_task_rank reads again.
    const results = await Promise.all([
      tasks.move(x, { status: 'todo', after: { kind: 'task', taskId: a.id } }),
      tasks.move(y, { status: 'todo', after: { kind: 'task', taskId: a.id } }),
    ]);
    expect(results).toEqual(['placed', 'placed']);
    const order = await column('todo');
    expect(order[0]).toBe('a');
    expect(order.slice(1, 3).sort()).toEqual(['x', 'y']);
    expect(order[3]).toBe('b');
  });

  it('refuses a position that is no longer in the column', async () => {
    const a = await add('a');
    const b = await add('b', 'done');
    expect(await tasks.move(a, { status: 'todo', after: { kind: 'task', taskId: b.id } })).toBe(
      'stale-position',
    );
  });

  it('keeps a task’s milestone in its project, nulls only the milestone when the milestone goes, and moves tasks with their milestone', async () => {
    const milestone = MilestoneEntity.createNew({
      organizationId,
      projectId,
      name: 'Ship 2.0',
      targetDate: null,
      createdByUserId: userId,
      actor: userActor(userId),
    });
    await milestones.insert(milestone);
    const task = await add('t', 'todo', milestone.id);
    await add('done one', 'done', milestone.id);
    expect((await milestones.findAll(scope(), {}))[0].progress).toEqual({ done: 1, total: 2 });

    // A task in another project cannot name this milestone: the composite key refuses it.
    task.actingAs(userActor(userId)).file(otherProjectId, milestone.id);
    await expect(tasks.saveFields(task)).rejects.toThrow(/FK_task_milestone/);

    milestone.actingAs(userActor(userId)).edit({ projectId: otherProjectId });
    await milestones.save(milestone);
    const moved = (await tasks.findOneById(scope(), task.id)).unwrap();
    expect(moved.projectId).toBe(otherProjectId);
    expect(moved.milestoneId).toBe(milestone.id);

    await milestones.delete(milestone);
    const kept = (await tasks.findOneById(scope(), task.id)).unwrap();
    expect(kept.milestoneId).toBeNull();
    expect(kept.projectId).toBe(otherProjectId);
  });

  it('moves a task to the top of In progress when a session is attached, unless it moved after the click', async () => {
    await add('already doing', 'doing');
    const task = await add('t');
    const sessionId = await insertSession();
    const link = {
      sessionId,
      origin: 'started' as const,
      linkedByUserId: userId,
      linkedAt: new Date(),
    };
    expect(await tasks.attach(task, link, 'todo')).toBe('attached');
    const started = (await tasks.findOneById(scope(), task.id)).unwrap();
    expect(started.status).toBe('doing');
    expect(started.sessions.map((s) => s.sessionId)).toEqual([sessionId]);
    expect(await column('doing')).toEqual(['t', 'already doing']);

    // Dragged to Later after the click: the link lands, the drag wins.
    const dragged = await add('dragged');
    const clicked = await reload(dragged.id);
    await tasks.move(await reload(dragged.id), { status: 'later', after: { kind: 'first' } });
    await tasks.attach(clicked, { ...link, sessionId: await insertSession() }, 'todo');
    expect((await tasks.findOneById(scope(), dragged.id)).unwrap().status).toBe('later');

    // Linking the same session twice links it once.
    await tasks.attach(started.actingAs(userActor(userId)), link, 'doing');
    expect((await tasks.findOneById(scope(), task.id)).unwrap().sessions).toHaveLength(1);
  });

  it('refuses a session of another workspace, and finds the tasks a session is on', async () => {
    const task = await add('t');
    const outsider = randomUUID();
    expect(
      await tasks.attach(
        task,
        { sessionId: outsider, origin: 'linked', linkedByUserId: userId, linkedAt: new Date() },
        'todo',
      ),
    ).toBe('session-not-found');

    const sessionId = await insertSession();
    await tasks.attach(
      await reload(task.id),
      { sessionId, origin: 'linked', linkedByUserId: userId, linkedAt: new Date() },
      'todo',
    );
    expect((await tasks.findAll(scope(), { sessionId })).map((t) => t.id)).toEqual([task.id]);
    await tasks.detach(task, sessionId);
    expect(await tasks.findAll(scope(), { sessionId })).toEqual([]);
  });

  it('shows another workspace nothing', async () => {
    const task = await add('t');
    const foreign = { ...scope(), organizationId: randomUUID() };
    expect((await tasks.findOneById(foreign, task.id)).isNone()).toBe(true);
    expect(await tasks.findAll(foreign, {})).toEqual([]);
  });

  it('logs each change worth logging once, with who made it, and nothing for a reorder or a notes edit', async () => {
    const agent: PlanActor = { type: 'agent', userId, agentId: randomUUID() };
    const a = await add('a');
    await add('b');
    // A reorder within the column and a notes edit write no event.
    await tasks.move(await reload(a.id), { status: 'todo', after: { kind: 'last' } });
    const notes = await reload(a.id);
    notes.edit({ notes: 'more detail' });
    await tasks.saveFields(notes);
    expect((await eventsOf(a.id)).map((e) => e.kind)).toEqual(['created']);

    const changed = await reload(a.id, agent);
    changed.edit({ dueDate: '2026-11-02' });
    changed.file(otherProjectId, null);
    changed.block('Waiting on the keystore fix');
    expect(await tasks.saveFields(changed)).toBe('saved');
    await tasks.move(await reload(a.id, agent), { status: 'doing', after: { kind: 'first' } });
    await tasks.move(await reload(a.id), { status: 'done', after: { kind: 'first' } });

    const events = await eventsOf(a.id);
    // One write logs its changes together; the writes come in the order they were made.
    expect(
      events
        .map((e) => e.kind)
        .slice(1, 4)
        .sort(),
    ).toEqual(['blocked', 'reassigned', 'rescheduled']);
    expect(events.map((e) => e.kind)).toHaveLength(6);
    expect([events[0].kind, events[4].kind, events[5].kind]).toEqual([
      'created',
      'status_changed',
      'completed',
    ]);
    expect(events.find((e) => e.kind === 'blocked')).toMatchObject({
      actorType: 'agent',
      actorUserId: userId,
      actorAgentId: agent.type === 'agent' ? agent.agentId : null,
      payload: { reason: 'Waiting on the keystore fix' },
    });
    expect(events.find((e) => e.kind === 'completed')?.actorType).toBe('user');
    // Done unblocks it.
    expect((await reload(a.id)).blockedReason).toBeNull();
  });

  it('keeps a completion when the task is reopened, and when it is deleted', async () => {
    const a = await add('a', 'done');
    await tasks.move(await reload(a.id), { status: 'todo', after: { kind: 'first' } });
    expect(await tasks.delete(await reload(a.id))).toBe('saved');
    const kinds = (await eventsOf(a.id)).map((e) => e.kind);
    expect(kinds.slice(0, 2).sort()).toEqual(['completed', 'created']);
    expect(kinds.slice(2)).toEqual(['reopened', 'deleted']);
  });

  it('refuses a write that names a version someone else has since moved on, and changes nothing', async () => {
    const a = await add('a');
    const agentRead = await reload(a.id, { type: 'agent', userId, agentId: randomUUID() });
    expect(agentRead.version).toBe(1);

    // The person edits from the console without naming a version: it lands and bumps it.
    const person = await reload(a.id);
    person.edit({ title: 'renamed by a person' });
    expect(await tasks.saveFields(person)).toBe('saved');
    expect((await reload(a.id)).version).toBe(2);

    // The agent's write, made on what it read before, is refused.
    agentRead.expectVersion(agentRead.version).edit({ title: 'renamed by an agent' });
    expect(await tasks.saveFields(agentRead)).toBe('version-conflict');
    const after = await reload(a.id);
    expect(after.title).toBe('renamed by a person');
    expect(after.version).toBe(2);

    // A move and a delete are versioned the same way.
    const stale = (await reload(a.id)).expectVersion(1);
    expect(await tasks.move(stale, { status: 'doing', after: { kind: 'first' } })).toBe(
      'version-conflict',
    );
    expect(await tasks.delete((await reload(a.id)).expectVersion(1))).toBe('version-conflict');
    expect(await tasks.delete((await reload(a.id)).expectVersion(2))).toBe('saved');
  });

  it('makes one task for a create retried with the same idempotency key', async () => {
    const create = () =>
      TaskEntity.createNew({
        organizationId,
        projectId,
        milestoneId: null,
        status: 'todo',
        title: 'from an agent',
        createdByUserId: userId,
        actor: userActor(userId),
        idempotencyKey: 'tool-call-1',
      });
    const first = create();
    expect(await tasks.insert(first, { status: 'todo', after: { kind: 'last' } })).toBe('placed');
    expect(await tasks.insert(create(), { status: 'todo', after: { kind: 'last' } })).toEqual({
      existingId: first.id,
    });
    expect(await column('todo')).toEqual(['from an agent']);
  });

  it('logs a milestone’s changes, and versions its writes', async () => {
    const milestone = MilestoneEntity.createNew({
      organizationId,
      projectId,
      name: 'Beta',
      targetDate: null,
      createdByUserId: userId,
      actor: userActor(userId),
    });
    expect(await milestones.insert(milestone)).toBe('inserted');
    const read = async () =>
      (await milestones.findOneById(scope(), milestone.id)).unwrap().actingAs(userActor(userId));
    const edited = await read();
    edited.edit({ name: 'Public beta', targetDate: '2026-12-01', projectId: otherProjectId });
    expect(await milestones.save(edited)).toBe('saved');
    expect(await milestones.save((await read()).expectVersion(1))).toBe('version-conflict');
    expect(await milestones.delete((await read()).expectVersion(2))).toBe('saved');
    expect((await eventsOf(milestone.id)).map((e) => e.kind).sort()).toEqual([
      'milestone_created',
      'milestone_deleted',
      'milestone_moved',
      'milestone_renamed',
      'milestone_retargeted',
    ]);
  });

  it('counts tasks created and completed per week in the viewer’s zone, past a deletion', async () => {
    const a = await add('a');
    await tasks.move(await reload(a.id), { status: 'done', after: { kind: 'first' } });
    await tasks.delete(await reload(a.id));
    // Sunday 23:30 in UTC, the night summer time ends, is already Monday in Madrid.
    await dataSource.query(
      `UPDATE plan_event SET "occurredAt" = '2026-10-25 23:30:00+00' WHERE "subjectId" = $1 AND kind = 'completed'`,
      [a.id],
    );
    await dataSource.query(
      `UPDATE plan_event SET "occurredAt" = '2026-10-20 10:00:00+00' WHERE "subjectId" = $1 AND kind = 'created'`,
      [a.id],
    );
    const counts = await planEvents.weeklyTaskCounts({
      organizationId,
      from: '2026-10-19',
      to: '2026-11-01',
      timeZone: 'Europe/Madrid',
    });
    expect(counts.sort((x, y) => x.kind.localeCompare(y.kind))).toEqual([
      { weekStart: '2026-10-26', projectId, kind: 'completed', count: 1 },
      { weekStart: '2026-10-19', projectId, kind: 'created', count: 1 },
    ]);
    expect(
      await planEvents.weeklyTaskCounts({
        organizationId,
        from: '2026-10-19',
        to: '2026-11-01',
        timeZone: 'UTC',
      }),
    ).toContainEqual({ weekStart: '2026-10-19', projectId, kind: 'completed', count: 1 });
  });

  it('erases a workspace’s events with the workspace', async () => {
    const a = await add('a');
    // Erasure deletes the workspace's projects (their tasks go with them), then the workspace.
    await dataSource.query(`DELETE FROM "project" WHERE "organizationId" = $1`, [organizationId]);
    expect((await eventsOf(a.id)).map((e) => e.kind)).toEqual(['created']);
    await dataSource.query(`DELETE FROM "organization" WHERE id = $1`, [organizationId]);
    expect(await eventsOf(a.id)).toEqual([]);
  });

  it('stages one change event per write, carrying its workspace', async () => {
    const a = await add('a');
    const changed = await reload(a.id);
    changed.edit({ title: 'x', dueDate: '2026-11-02' });
    changed.block('waiting');
    await tasks.saveFields(changed);
    await tasks.delete(await reload(a.id));
    const rows: { payload: { organizationId: string; change: string } }[] = await dataSource.query(
      `SELECT payload FROM outbox_message WHERE "eventName" = 'TaskChangedDomainEvent' AND "aggregateId" = $1 ORDER BY "createdAt"`,
      [a.id],
    );
    expect(rows.map((row) => row.payload.change)).toEqual(['created', 'updated', 'deleted']);
    expect(rows.every((row) => row.payload.organizationId === organizationId)).toBe(true);
  });
});
