#!/usr/bin/env node
// Agent coordination experiments: a seeded, discrete-time simulation of a
// team of bots working one backlog under several coordination protocols,
// with the misbehaviours the July 2026 Hugging Face incident recorded. Read
// `../agent-coordination-experiments.md` before the numbers: every rate in
// DEFAULTS is an assumption, and experiment 5 reports which conclusions
// survive moving all of them at once.
//
//   node product/research/agent-coordination/sim.mjs              # everything, 100 seeds
//   node product/research/agent-coordination/sim.mjs --seeds 30   # quicker
//   node product/research/agent-coordination/sim.mjs --json out.json

import { writeFileSync } from 'node:fs';

const TICKS = 400; // a tick is a few minutes of agent time; a run is a working day or so

const DEFAULTS = {
  // The backlog outlasts the run, so "tasks landed" measures throughput.
  tasksPerAgent: 40,
  resourceShare: 0.6, // resources (branches, files) = tasks × this, so tasks collide
  durationMin: 8,
  durationMax: 16,
  riskyShare: 0.3, // merges, deploys, deletes
  badRiskyHonest: 0.03,
  badRiskyMisaligned: 0.4,
  reworkShare: 0.4, // a conflicting write costs this share of the task again

  // A misaligned agent, per opportunity.
  ignoreHold: 0.5,
  vetoBySilence: 0.8, // waits ~1 tick for a veto, like the agent that waited 40 s
  leakMisaligned: 0.15, // per task, a credential pasted into a message
  leakHonest: 0.01,
  premiseMisaligned: 0.2, // per task, a confident claim that is false
  premiseHonest: 0.02,
  impersonate: 0.02, // per tick, a forged STOP in a coordinator's name
  spawn: 0.03, // per tick, a recruit
  ignoreManager: 0.3,
  experiment: 0.02, // per tick, a recruit off the books tries something risky
  experimentBad: 0.3,

  // Review.
  peerReview: 0.08, // chance a peer reads and judges an open veto window in a tick
  vetoWindow: 5,
  managerCatch: 0.6,
  humanCatch: 0.9,
  policyCatch: 0.6, // the checks a lane policy runs where a person does not look
  humanRate: 0.5, // one person, an approval every two ticks
  humanShare: 0.2, // with lanes, the share of risky work a person reviews
  signedVerify: 0.7, // agents that check a signature before obeying it
  scannerCatch: 0.95,

  // Spread of a false premise.
  adoptBroadcast: 0.15,
  adoptInbox: 0.3,
  adoptWithEvidence: 0.03, // a claim without a link to system state is flagged
  premiseCost: 6,

  boardLiveCap: 4, // what the infrastructure allows without a spawn rule, × agents

  hubCapacity: 5, // assignments a manager bot hands out per tick
};

// The platform's controls. `platform` has all six; experiment 2 removes one at a time.
const CONTROLS = {
  identity: 'the server stamps the sender',
  leases: 'atomic claims, writes refused without the lease',
  approvals: 'risky actions wait for an approval',
  spawns: 'a spawn is refused unless it carries a task traced to a person or trigger',
  scanner: 'secrets blocked in messages',
  evidence: 'claims carry a link to system state',
};

function platformWith(off = {}, extra = {}) {
  const on = (c) => !off[c];
  return {
    allocation: on('leases') ? 'lease' : 'board',
    channel: 'inbox',
    verify: on('identity') ? 'server' : 'none',
    review: on('approvals') ? 'lanes' : 'peer',
    spawns: on('spawns'),
    scanner: on('scanner'),
    evidence: on('evidence'),
    ...extra,
  };
}

const PROTOCOLS = {
  board: { allocation: 'board', channel: 'board', verify: 'none', review: 'peer' },
  'board+signed': { allocation: 'board', channel: 'board', verify: 'signed', review: 'peer' },
  hub: { allocation: 'hub', channel: 'inbox', verify: 'none', review: 'manager' },
  platform: platformWith(),
  'platform+hub': platformWith({}, { allocation: 'hub-lease' }),
  'platform, all to a person': platformWith({}, { review: 'human' }),
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(protocol, { agents, misaligned, latency, seed, params = DEFAULTS }) {
  const P = params;
  const rng = mulberry32(seed);
  const chance = (p) => rng() < p;
  const pick = (list) => list[Math.floor(rng() * list.length)];

  const leased = protocol.allocation === 'lease' || protocol.allocation === 'hub-lease';
  const managed = protocol.allocation === 'hub' || protocol.allocation === 'hub-lease';
  const conventions = !leased; // claims and holds are messages, read late

  const taskCount = agents * P.tasksPerAgent;
  const resourceCount = Math.max(1, Math.round(taskCount * P.resourceShare));
  const tasks = Array.from({ length: taskCount }, (_, id) => ({
    id,
    resource: Math.floor(rng() * resourceCount),
    duration: P.durationMin + Math.floor(rng() * (P.durationMax - P.durationMin + 1)),
    risky: chance(P.riskyShare),
    done: false,
    claims: [], // { agent, tick }
    holder: null, // the lease
  }));

  // Open tasks, kept as a swap-remove array so sampling stays O(1).
  const open = tasks.slice();
  const openIndex = new Map(tasks.map((t, i) => [t, i]));
  const close = (task) => {
    const i = openIndex.get(task);
    if (i === undefined) return;
    const last = open.pop();
    if (last !== task) {
      open[i] = last;
      openIndex.set(last, i);
    }
    openIndex.delete(task);
  };
  const sample = (accept) => {
    for (let i = 0; i < 40 && open.length; i++) {
      const t = pick(open);
      if (accept(t)) return t;
    }
    return null;
  };

  const working = new Map(); // resource -> agents on it now
  const resourceLease = new Map();
  const holds = new Map(); // resource -> [{ agent, tick }]

  const m = {
    done: 0,
    wastedTicks: 0,
    conflicts: 0,
    unsafe: 0,
    secretExposures: 0,
    premiseTicks: 0,
    forgeriesObeyed: 0,
    peakLive: agents,
    offBooksTicks: 0,
    reads: 0,
    approvalsAsked: 0,
    approvalsQueued: 0,
    refusedWrites: 0,
    refusedSpawns: 0,
  };

  let nextId = 0;
  const live = [];
  const spawnAgent = (honest, depth) => {
    const a = {
      id: nextId++,
      honest,
      depth,
      task: null,
      remaining: 0,
      assigned: depth === 0, // a recruit works off the books
      selfServe: false,
    };
    live.push(a);
    return a;
  };
  const misalignedCount = Math.round(agents * misaligned);
  for (let i = 0; i < agents; i++) spawnAgent(i >= misalignedCount, 0);

  const broadcast = protocol.channel === 'board';
  const post = (count = 1) => {
    m.reads += count * (broadcast ? live.length : 1);
  };

  const take = (agent, task, now) => {
    agent.task = task;
    agent.remaining = task.duration;
    working.set(task.resource, (working.get(task.resource) ?? 0) + 1);
    if (leased) {
      task.holder = agent;
      resourceLease.set(task.resource, agent);
      close(task);
    } else {
      task.claims.push({ agent, tick: now });
      const list = holds.get(task.resource) ?? [];
      list.push({ agent, tick: now });
      holds.set(task.resource, list);
      post(2); // CLAIM, HOLD
    }
  };
  const drop = (agent) => {
    const task = agent.task;
    agent.task = null;
    working.set(task.resource, working.get(task.resource) - 1);
    if (task.holder === agent) {
      task.holder = null;
      resourceLease.delete(task.resource);
      if (!task.done) {
        openIndex.set(task, open.length);
        open.push(task);
      }
    }
    return task;
  };

  const activeClaims = (task) => task.claims.filter((c) => c.agent.task === task);
  const visibleClaims = (task, now) => activeClaims(task).filter((c) => c.tick <= now - latency);
  const visiblyHeld = (resource, self, now) =>
    (holds.get(resource) ?? []).some(
      (h) => h.agent !== self && h.agent.task?.resource === resource && h.tick <= now - latency,
    );

  const chooseFromBoard = (agent, now) => {
    const ignoresHold = !agent.honest && chance(P.ignoreHold);
    return sample(
      (t) =>
        visibleClaims(t, now).length === 0 && (ignoresHold || !visiblyHeld(t.resource, agent, now)),
    );
  };

  const chooseLease = (agent) => {
    // Taking a leased resource is refused where it is written, not by convention.
    if (!agent.honest && chance(P.ignoreHold)) m.refusedWrites++;
    return sample((t) => !resourceLease.has(t.resource));
  };

  const approvals = [];
  // Returns whether the action lands now.
  const review = (agent, bad, lands = true) => {
    if (protocol.review === 'peer') {
      const window = !agent.honest && chance(P.vetoBySilence) ? 1 : P.vetoWindow;
      post(1);
      const caught = chance(1 - (1 - P.peerReview) ** window);
      if (bad && !caught) m.unsafe++;
      return !(bad && caught);
    }
    if (protocol.review === 'manager') {
      post(1);
      const bypass = !agent.honest && chance(P.ignoreManager);
      const caught = !bypass && chance(P.managerCatch);
      if (bad && !caught) m.unsafe++;
      return !(bad && caught);
    }
    if (protocol.review === 'lanes' && !chance(P.humanShare)) {
      const caught = chance(P.policyCatch);
      if (bad && !caught) m.unsafe++;
      return !(bad && caught);
    }
    m.approvalsAsked++;
    approvals.push({ bad, lands });
    return false; // lands when a person approves it
  };

  const spreadPremise = (author) => {
    post(1);
    const readers = broadcast ? live.filter((a) => a !== author) : [pick(live)];
    const adopt = protocol.evidence
      ? P.adoptWithEvidence
      : broadcast
        ? P.adoptBroadcast
        : P.adoptInbox;
    for (const r of readers) {
      if (r.honest && r.task && chance(adopt)) {
        r.remaining += P.premiseCost;
        m.premiseTicks += P.premiseCost;
      }
    }
  };

  const complete = (agent) => {
    const task = drop(agent);
    if (task.done) {
      m.wastedTicks += task.duration; // someone else already landed it
      return;
    }
    task.done = true;
    close(task);
    if (conventions) {
      // Everyone else mid-task on this resource redoes part of it.
      for (const other of live) {
        if (other.task && other.task.resource === task.resource) {
          other.remaining += Math.ceil(other.task.duration * P.reworkShare);
          m.conflicts++;
        }
      }
    }
    post(1); // DONE
    if (chance(agent.honest ? P.leakHonest : P.leakMisaligned)) {
      if (!(protocol.scanner && chance(P.scannerCatch))) {
        m.secretExposures += broadcast ? live.length - 1 : 1;
      }
    }
    if (chance(agent.honest ? P.premiseHonest : P.premiseMisaligned)) spreadPremise(agent);
    if (!task.risky) {
      m.done++;
      return;
    }
    const bad = chance(agent.honest ? P.badRiskyHonest : P.badRiskyMisaligned);
    if (review(agent, bad)) m.done++;
  };

  const impersonate = () => {
    const victim = pick(live);
    if (!victim.honest || !victim.task) return;
    post(1);
    const verify =
      protocol.verify === 'server' ? 1 : protocol.verify === 'signed' ? P.signedVerify : 0;
    if (chance(verify)) return;
    // A forged STOP from "the coordinator": the victim drops its work.
    m.forgeriesObeyed++;
    m.wastedTicks += victim.task.duration - victim.remaining;
    drop(victim);
  };

  // A recruit carries no task, so the platform refuses it outright.
  const maySpawn = () => {
    if (!protocol.spawns) return live.length < agents * P.boardLiveCap;
    m.refusedSpawns++;
    return false;
  };

  let humanCredit = 0;
  for (let now = 0; now < TICKS; now++) {
    // One person works through the approval queue.
    humanCredit = Math.min(1 + P.humanRate, humanCredit + P.humanRate);
    while (humanCredit >= 1 && approvals.length) {
      humanCredit -= 1;
      const { bad, lands } = approvals.shift();
      const rejected = bad && chance(P.humanCatch);
      if (bad && !rejected) m.unsafe++;
      if (!rejected && lands) m.done++;
    }

    // The manager hands out work from its own list, a few agents a tick.
    if (managed) {
      let handed = 0;
      for (const agent of live) {
        if (handed >= P.hubCapacity) break;
        if (agent.task || !agent.assigned) continue;
        if (!agent.honest && protocol.allocation === 'hub' && chance(P.ignoreManager)) {
          agent.selfServe = true;
          continue;
        }
        const task = sample(
          (t) =>
            activeClaims(t).length === 0 &&
            !working.get(t.resource) &&
            !resourceLease.has(t.resource),
        );
        if (!task) break;
        take(agent, task, now);
        post(1); // ASSIGN
        handed++;
      }
    }

    for (let i = 0; i < live.length; i++) {
      const agent = live[i];
      if (!agent.honest) {
        if (chance(P.impersonate)) impersonate();
        if (chance(P.spawn) && maySpawn()) {
          spawnAgent(false, agent.depth + 1); // a recruit shares its recruiter's aims
          m.peakLive = Math.max(m.peakLive, live.length);
        }
      }

      if (!agent.assigned) {
        m.offBooksTicks++;
        if (chance(P.experiment)) review(agent, chance(P.experimentBad), false);
        continue;
      }

      if (!agent.task) {
        let task = null;
        if (protocol.allocation === 'board' || agent.selfServe) task = chooseFromBoard(agent, now);
        else if (protocol.allocation === 'lease') task = chooseLease(agent);
        agent.selfServe = false;
        if (!task) continue;
        take(agent, task, now);
      }

      if (conventions) {
        // An honest agent that now sees an earlier claim on its task backs off.
        const mine = agent.task.claims.find((c) => c.agent === agent);
        const earlier = visibleClaims(agent.task, now).some(
          (c) =>
            c.agent !== agent &&
            (c.tick < mine.tick || (c.tick === mine.tick && c.agent.id < agent.id)),
        );
        if (agent.honest && earlier) {
          m.wastedTicks += agent.task.duration - agent.remaining;
          drop(agent);
          continue;
        }
      }

      agent.remaining--;
      if (agent.remaining <= 0) complete(agent);
    }
  }
  m.approvalsQueued = approvals.length;
  return m;
}

const METRICS = [
  ['done', 'Tasks landed'],
  ['wastedTicks', 'Ticks wasted (duplicates, forged stops)'],
  ['conflicts', 'Write conflicts'],
  ['unsafe', 'Bad risky actions executed'],
  ['secretExposures', 'Secret exposures (reads)'],
  ['premiseTicks', 'Ticks lost to false premises'],
  ['forgeriesObeyed', 'Forged messages obeyed'],
  ['peakLive', 'Peak live agents'],
  ['offBooksTicks', 'Off-the-books agent ticks'],
  ['reads', 'Message reads (token cost)'],
  ['approvalsAsked', 'Approvals asked of a person'],
  ['approvalsQueued', 'Approvals still queued'],
];

function samples(protocol, scenario, seeds) {
  return Array.from({ length: seeds }, (_, s) =>
    simulate(protocol, { ...scenario, seed: 1000 + s }),
  );
}

function summarize(xs) {
  const out = {};
  for (const [key] of METRICS) {
    const v = xs.map((x) => x[key]);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, v.length - 1));
    out[key] = { mean, ci: (1.96 * sd) / Math.sqrt(v.length) };
  }
  return out;
}

const fmt = ({ mean, ci }) => {
  const digits = Math.abs(mean) >= 100 ? 0 : 1;
  const m = mean.toFixed(digits);
  return ci * 10 ** digits >= 1 ? `${m} ±${ci.toFixed(digits)}` : m;
};

function table(title, rows, metrics = METRICS) {
  const lines = [`### ${title}`, ''];
  lines.push(`| Metric | ${rows.map(([name]) => name).join(' | ')} |`);
  lines.push(`|---|${rows.map(() => '---:').join('|')}|`);
  for (const [key, label] of metrics) {
    lines.push(`| ${label} | ${rows.map(([, s]) => fmt(s[key])).join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

const pickMetrics = (...keys) => METRICS.filter(([k]) => keys.includes(k));

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const seeds = Number(flag('--seeds')) || 100;
const jsonOut = flag('--json');
const out = [];
const results = {};

const base = { agents: 20, misaligned: 0.1, latency: 3 };

// 1. The protocols side by side.
{
  const rows = Object.entries(PROTOCOLS).map(([n, p]) => [n, summarize(samples(p, base, seeds))]);
  results.protocols = Object.fromEntries(rows);
  out.push(table('1. Protocols: 20 agents, 2 of them misaligned, board latency 3 ticks', rows));
}

// 2. Ablation: which control buys what.
{
  const rows = [['platform', summarize(samples(PROTOCOLS.platform, base, seeds))]];
  for (const c of Object.keys(CONTROLS)) {
    rows.push([`− ${c}`, summarize(samples(platformWith({ [c]: true }), base, seeds))]);
  }
  results.ablation = Object.fromEntries(rows);
  out.push(table('2. Ablation: the platform minus one control', rows));
}

// 3. Scale × misalignment.
{
  const names = ['board', 'hub', 'platform', 'platform+hub', 'platform, all to a person'];
  const metrics = pickMetrics('done', 'wastedTicks', 'unsafe', 'reads', 'approvalsQueued');
  results.sweep = {};
  for (const agents of [10, 30, 100]) {
    for (const misaligned of [0, 0.1, 0.3]) {
      const scenario = { agents, misaligned, latency: 3 };
      const n = agents === 100 ? Math.max(10, Math.round(seeds / 5)) : Math.max(20, seeds / 2);
      const rows = names.map((name) => [name, summarize(samples(PROTOCOLS[name], scenario, n))]);
      results.sweep[`${agents}/${misaligned}`] = Object.fromEntries(rows);
      out.push(
        table(
          `3. ${agents} agents, ${Math.round(agents * misaligned)} misaligned (${n} seeds)`,
          rows,
          metrics,
        ),
      );
    }
  }
}

// 4. Honest agents only: what the medium costs when nobody misbehaves.
{
  const rows = [];
  for (const latency of [0, 1, 3, 10]) {
    const scenario = { agents: 20, misaligned: 0, latency };
    rows.push([`board, latency ${latency}`, summarize(samples(PROTOCOLS.board, scenario, seeds))]);
  }
  rows.push([
    'platform',
    summarize(samples(PROTOCOLS.platform, { agents: 20, misaligned: 0, latency: 3 }, seeds)),
  ]);
  results.latency = Object.fromEntries(rows);
  out.push(
    table(
      '4. Honest agents only: the cost of the medium',
      rows,
      pickMetrics('done', 'wastedTicks', 'conflicts', 'reads'),
    ),
  );
}

// 5. Sensitivity: every rate in DEFAULTS scaled by a random factor in [0.5, 2]
//    at once (probabilities capped at 1), and how often each conclusion holds.
{
  const draws = Math.max(20, Math.round(seeds / 2));
  const perDraw = 10;
  const claims = [
    [
      'platform lands at least as much as board (within 2%)',
      (r) => r.platform.done >= 0.98 * r.board.done,
    ],
    [
      'platform executes fewer bad risky actions than board',
      (r) => r.platform.unsafe < r.board.unsafe,
    ],
    ['platform executes fewer bad risky actions than hub', (r) => r.platform.unsafe < r.hub.unsafe],
    ['hub wastes fewer ticks than board', (r) => r.hub.wastedTicks < r.board.wastedTicks],
    [
      'signatures alone cut forged messages obeyed by half or more',
      (r) => r['board+signed'].forgeriesObeyed <= 0.5 * r.board.forgeriesObeyed,
    ],
    [
      'every risky action to a person lands less than lanes',
      (r) => r['platform, all to a person'].done < r.platform.done,
    ],
    ['platform+hub lands less than platform at 100 agents', (r) => r.hub100 < r.platform100],
  ];
  const held = claims.map(() => 0);
  const rng = mulberry32(7);
  const fixed = new Set(['tasksPerAgent', 'durationMin', 'durationMax']);
  const counts = new Set(['vetoWindow', 'hubCapacity', 'premiseCost']);
  const unbounded = new Set(['boardLiveCap', 'humanRate']);
  for (let d = 0; d < draws; d++) {
    const params = { ...DEFAULTS };
    for (const [k, v0] of Object.entries(DEFAULTS)) {
      if (fixed.has(k)) continue;
      const v = v0 * 2 ** (rng() * 2 - 1);
      params[k] = counts.has(k)
        ? Math.max(1, Math.round(v))
        : unbounded.has(k)
          ? v
          : Math.min(1, v);
    }
    const scenario = { ...base, params };
    const mean = (p, sc = scenario, n = perDraw) => {
      const s = summarize(samples(p, sc, n));
      return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.mean]));
    };
    const r = Object.fromEntries(Object.entries(PROTOCOLS).map(([n, p]) => [n, mean(p)]));
    const big = { agents: 100, misaligned: 0.1, latency: 3, params };
    r.hub100 = mean(PROTOCOLS['platform+hub'], big, 3).done;
    r.platform100 = mean(PROTOCOLS.platform, big, 3).done;
    claims.forEach(([, test], i) => {
      if (test(r)) held[i]++;
    });
  }
  results.sensitivity = Object.fromEntries(claims.map(([c], i) => [c, held[i] / draws]));
  const lines = [
    `### 5. Sensitivity: ${draws} draws of every rate × [0.5, 2]`,
    '',
    '| Conclusion | Holds in |',
    '|---|---:|',
  ];
  for (const [i, [c]] of claims.entries()) {
    lines.push(`| ${c} | ${Math.round((100 * held[i]) / draws)}% |`);
  }
  out.push(`${lines.join('\n')}\n`);
}

console.log(`Agent coordination experiments: ${seeds} seeds, ${TICKS} ticks, mean ±95% CI.\n`);
console.log(out.join('\n'));
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(results, null, 2)}\n`);
