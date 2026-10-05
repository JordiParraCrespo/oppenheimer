import { randomUUID } from 'node:crypto';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { OutboxMessageSchema, OutboxService } from '@oppenheimer/backend-ddd';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { DataSource } from 'typeorm';
import { runAllMigrations } from '../../__tests__/run-migrations';
import { GoalOrmEntity } from '../database/goal.orm-entity';
import { GoalRepository } from '../database/goal.repository';
import { TaskOrmEntity } from '../database/task.orm-entity';
import { TaskRepository } from '../database/task.repository';
import { TaskSessionOrmEntity } from '../database/task-session.orm-entity';
import { GoalEntity } from '../domain/goal.entity';
import { TaskEntity } from '../domain/task.entity';
import { GoalMapper } from '../goal.mapper';
import { TaskMapper } from '../task.mapper';

/**
 * Plan's board against a real Postgres (`product/versions/mvp/19-plan-tasks-and-goals.md`):
 * the order a column keeps under concurrent moves, the one goal key and what it carries,
 * and the attach rule's lock. The schema is the migrations', so a wrong key fails here.
 */
describe('tasks: the board (integration)', () => {
  let pg: StartedTestContainer;
  let dataSource: DataSource;
  let tasks: TaskRepository;
  let goals: GoalRepository;
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
      entities: [TaskOrmEntity, GoalOrmEntity, TaskSessionOrmEntity, OutboxMessageSchema],
      synchronize: false,
    });
    await dataSource.initialize();
    const outbox = new OutboxService(dataSource);
    tasks = new TaskRepository(dataSource.getRepository(TaskOrmEntity), new TaskMapper(), outbox);
    goals = new GoalRepository(dataSource.getRepository(GoalOrmEntity), new GoalMapper());
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
    goalId: string | null = null,
  ) {
    const task = TaskEntity.createNew({
      organizationId,
      projectId,
      goalId,
      status,
      title,
      createdByUserId: userId,
    });
    expect(await tasks.insert(task, { status, after: { kind: 'last' } })).toBe('placed');
    return task;
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

  it('keeps a task’s goal in its project, nulls only the goal when the goal goes, and moves tasks with their goal', async () => {
    const goal = GoalEntity.createNew({
      organizationId,
      projectId,
      name: 'Ship 2.0',
      targetDate: null,
      createdByUserId: userId,
    });
    await goals.insert(goal);
    const task = await add('t', 'todo', goal.id);
    await add('done one', 'done', goal.id);
    expect((await goals.findAll(scope(), {}))[0].progress).toEqual({ done: 1, total: 2 });

    // A task in another project cannot name this goal: the composite key refuses it.
    task.file(otherProjectId, goal.id);
    await expect(tasks.saveFields(task)).rejects.toThrow(/FK_task_goal/);

    goal.edit({ projectId: otherProjectId });
    await goals.save(goal);
    const moved = (await tasks.findOneById(scope(), task.id)).unwrap();
    expect(moved.projectId).toBe(otherProjectId);
    expect(moved.goalId).toBe(goal.id);

    await goals.delete(goal);
    const kept = (await tasks.findOneById(scope(), task.id)).unwrap();
    expect(kept.goalId).toBeNull();
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
    await tasks.move(dragged, { status: 'later', after: { kind: 'first' } });
    const stale = (await tasks.findOneById(scope(), dragged.id)).unwrap();
    await tasks.attach(stale, { ...link, sessionId: await insertSession() }, 'todo');
    expect((await tasks.findOneById(scope(), dragged.id)).unwrap().status).toBe('later');

    // Linking the same session twice links it once.
    await tasks.attach(started, link, 'doing');
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
      task,
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
});
