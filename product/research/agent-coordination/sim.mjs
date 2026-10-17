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

// A protocol is one strategy per axis: how work is allocated, how messages
// travel, how a sender is known, how a risky action is reviewed, whether a
// spawn is allowed, whether messages are scanned for secrets, and whether
// claims need evidence. The tick loop in `simulate` calls the same hooks for
// every protocol; each strategy below is the whole of one choice.
//
// Every hook takes the run's world `w` (see `simulate`). The order of random
// draws inside a hook is part of the experiment: two runs are byte-identical
// only while it stays fixed.

const board = {
  conventions: true, // claims and holds are messages, read `latency` ticks late
  choose(w, agent, now) {
    const ignoresHold = !agent.honest && w.chance(w.P.ignoreHold);
    return w.sample(
      (t) =>
        w.visibleClaims(t, now).length === 0 &&
        (ignoresHold || !w.visiblyHeld(t.resource, agent, now)),
    );
  },
  take(w, agent, task, now) {
    task.claims.push({ agent, tick: now });
    const list = w.holds.get(task.resource) ?? [];
    list.push({ agent, tick: now });
    w.holds.set(task.resource, list);
    w.post(2); // CLAIM, HOLD
  },
  release() {},
};

const lease = {
  conventions: false,
  choose(w, agent) {
    // Taking a leased resource is refused where it is written, not by convention.
    if (!agent.honest && w.chance(w.P.ignoreHold)) w.m.refusedWrites++;
    return w.sample((t) => !w.resourceLease.has(t.resource));
  },
  take(w, agent, task) {
    task.holder = agent;
    w.resourceLease.set(task.resource, agent);
    w.close(task);
  },
  release(w, agent, task) {
    if (task.holder !== agent) return;
    task.holder = null;
    w.resourceLease.delete(task.resource);
    if (!task.done) w.reopen(task);
  },
};

// A manager bot hands out work from its own list, `hubCapacity` agents a tick,
// on top of either board conventions or leases.
function managed(base, { obeyed }) {
  return {
    ...base,
    assign(w, now) {
      let handed = 0;
      for (const agent of w.live) {
        if (handed >= w.P.hubCapacity) break;
        if (agent.task || !agent.assigned) continue;
        if (!obeyed && !agent.honest && w.chance(w.P.ignoreManager)) {
          agent.selfServe = true;
          continue;
        }
        const task = w.sample(
          (t) =>
            w.activeClaims(t).length === 0 &&
            !w.working.get(t.resource) &&
            !w.resourceLease.has(t.resource),
        );
        if (!task) break;
        w.take(agent, task, now);
        w.post(1); // ASSIGN
        handed++;
      }
    },
    // Only an agent that ignored the manager this tick serves itself.
    choose(w, agent, now) {
      return agent.selfServe ? board.choose(w, agent, now) : null;
    },
  };
}

const ALLOCATION = {
  board,
  lease,
  hub: managed(board, { obeyed: false }),
  'hub-lease': managed(lease, { obeyed: true }),
};

const CHANNEL = {
  board: { broadcast: true, readsPerPost: (w) => w.live.length },
  inbox: { broadcast: false, readsPerPost: () => 1 },
};

const IDENTITY = {
  claimed: () => 0,
  signed: (P) => P.signedVerify,
  server: () => 1,
};

// A review returns whether the action lands now; a queued one lands when a
// person approves it.
function settle(w, bad, caught) {
  if (bad && !caught) w.m.unsafe++;
  return !(bad && caught);
}

function askPerson(w, bad, lands) {
  w.m.approvalsAsked++;
  w.approvals.push({ bad, lands });
  return false;
}

const REVIEW = {
  peer(w, agent, bad) {
    const window = !agent.honest && w.chance(w.P.vetoBySilence) ? 1 : w.P.vetoWindow;
    w.post(1);
    return settle(w, bad, w.chance(1 - (1 - w.P.peerReview) ** window));
  },
  manager(w, agent, bad) {
    w.post(1);
    const bypass = !agent.honest && w.chance(w.P.ignoreManager);
    return settle(w, bad, !bypass && w.chance(w.P.managerCatch));
  },
  lanes(w, _agent, bad, lands) {
    if (w.chance(w.P.humanShare)) return askPerson(w, bad, lands);
    return settle(w, bad, w.chance(w.P.policyCatch));
  },
  human: (w, _agent, bad, lands) => askPerson(w, bad, lands),
};

const SPAWNS = {
  open: (w) => w.live.length < w.agents * w.P.boardLiveCap,
  // A recruit carries no task, so the platform refuses it outright.
  refused(w) {
    w.m.refusedSpawns++;
    return false;
  },
};

const SCANNER = {
  off: () => false,
  on: (w) => w.chance(w.P.scannerCatch),
};

const EVIDENCE = {
  off: (w) => (w.channel.broadcast ? w.P.adoptBroadcast : w.P.adoptInbox),
  on: (w) => w.P.adoptWithEvidence,
};

function protocol({
  allocation,
  channel,
  identity = 'claimed',
  review,
  spawns = 'open',
  scanner = 'off',
  evidence = 'off',
}) {
  return {
    allocation: ALLOCATION[allocation],
    channel: CHANNEL[channel],
    verify: IDENTITY[identity],
    review: REVIEW[review],
    maySpawn: SPAWNS[spawns],
    scannerBlocks: SCANNER[scanner],
    adoption: EVIDENCE[evidence],
  };
}

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
  return protocol({
    allocation: on('leases') ? 'lease' : 'board',
    channel: 'inbox',
    identity: on('identity') ? 'server' : 'claimed',
    review: on('approvals') ? 'lanes' : 'peer',
    spawns: on('spawns') ? 'refused' : 'open',
    scanner: on('scanner') ? 'on' : 'off',
    evidence: on('evidence') ? 'on' : 'off',
    ...extra,
  });
}

const PROTOCOLS = {
  board: protocol({ allocation: 'board', channel: 'board', review: 'peer' }),
  'board+signed': protocol({
    allocation: 'board',
    channel: 'board',
    identity: 'signed',
    review: 'peer',
  }),
  hub: protocol({ allocation: 'hub', channel: 'inbox', review: 'manager' }),
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

// The world one run happens in: the backlog, the agents, the metrics and the
// shared operations every strategy uses.
function createWorld(proto, { agents, misaligned, latency, seed, params }) {
  const P = params;
  const rng = mulberry32(seed);
  const chance = (p) => rng() < p;
  const pick = (list) => list[Math.floor(rng() * list.length)];

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

  const w = {
    P,
    agents,
    chance,
    pick,
    tasks,
    live: [],
    working: new Map(), // resource -> agents on it now
    resourceLease: new Map(),
    holds: new Map(), // resource -> [{ agent, tick }]
    approvals: [],
    channel: proto.channel,
    m: {
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
    },
    close(task) {
      const i = openIndex.get(task);
      if (i === undefined) return;
      const last = open.pop();
      if (last !== task) {
        open[i] = last;
        openIndex.set(last, i);
      }
      openIndex.delete(task);
    },
    reopen(task) {
      openIndex.set(task, open.length);
      open.push(task);
    },
    // Up to SAMPLE_TRIES random open tasks; null when none passes, which an
    // agent reads as "nothing to take this tick".
    sample(accept) {
      for (let i = 0; i < SAMPLE_TRIES && open.length; i++) {
        const t = pick(open);
        if (accept(t)) return t;
      }
      return null;
    },
    post(count = 1) {
      w.m.reads += count * proto.channel.readsPerPost(w);
    },
    activeClaims: (task) => task.claims.filter((c) => c.agent.task === task),
    visibleClaims: (task, now) => w.activeClaims(task).filter((c) => c.tick <= now - latency),
    visiblyHeld: (resource, self, now) =>
      (w.holds.get(resource) ?? []).some(
        (h) => h.agent !== self && h.agent.task?.resource === resource && h.tick <= now - latency,
      ),
    take(agent, task, now) {
      agent.task = task;
      agent.remaining = task.duration;
      w.working.set(task.resource, (w.working.get(task.resource) ?? 0) + 1);
      proto.allocation.take(w, agent, task, now);
    },
    drop(agent) {
      const task = agent.task;
      agent.task = null;
      w.working.set(task.resource, w.working.get(task.resource) - 1);
      proto.allocation.release(w, agent, task);
      return task;
    },
    spawn(honest, depth) {
      // A recruit works off the books.
      w.live.push({
        id: w.live.length,
        honest,
        depth,
        task: null,
        remaining: 0,
        assigned: depth === 0,
        selfServe: false,
      });
    },
  };
  const misalignedCount = Math.round(agents * misaligned);
  for (let i = 0; i < agents; i++) w.spawn(i >= misalignedCount, 0);
  return w;
}

const SAMPLE_TRIES = 40;

function simulate(proto, { params = DEFAULTS, ...scenario }) {
  const w = createWorld(proto, { ...scenario, params });
  const { P, m, chance } = w;
  const alloc = proto.allocation;

  const review = (agent, bad, lands = true) => proto.review(w, agent, bad, lands);

  const spreadPremise = (author) => {
    w.post(1);
    const readers = proto.channel.broadcast ? w.live.filter((a) => a !== author) : [w.pick(w.live)];
    const adopt = proto.adoption(w);
    for (const r of readers) {
      if (r.honest && r.task && chance(adopt)) {
        r.remaining += P.premiseCost;
        m.premiseTicks += P.premiseCost;
      }
    }
  };

  const complete = (agent) => {
    const task = w.drop(agent);
    if (task.done) {
      m.wastedTicks += task.duration; // someone else already landed it
      return;
    }
    task.done = true;
    w.close(task);
    if (alloc.conventions) {
      // Everyone else mid-task on this resource redoes part of it.
      for (const other of w.live) {
        if (other.task && other.task.resource === task.resource) {
          other.remaining += Math.ceil(other.task.duration * P.reworkShare);
          m.conflicts++;
        }
      }
    }
    w.post(1); // DONE
    if (chance(agent.honest ? P.leakHonest : P.leakMisaligned) && !proto.scannerBlocks(w)) {
      m.secretExposures += proto.channel.broadcast ? w.live.length - 1 : 1;
    }
    if (chance(agent.honest ? P.premiseHonest : P.premiseMisaligned)) spreadPremise(agent);
    if (!task.risky) {
      m.done++;
      return;
    }
    const bad = chance(agent.honest ? P.badRiskyHonest : P.badRiskyMisaligned);
    if (review(agent, bad)) m.done++;
  };

  // A forged STOP from "the coordinator": the victim drops its work unless
  // it can tell the sender is not who the message claims.
  const impersonate = () => {
    const victim = w.pick(w.live);
    if (!victim.honest || !victim.task) return;
    w.post(1);
    if (chance(proto.verify(P))) return;
    m.forgeriesObeyed++;
    m.wastedTicks += victim.task.duration - victim.remaining;
    w.drop(victim);
  };

  // An honest agent that now sees an earlier claim on its task backs off.
  const outbid = (agent, now) => {
    const mine = agent.task.claims.find((c) => c.agent === agent);
    return w
      .visibleClaims(agent.task, now)
      .some(
        (c) =>
          c.agent !== agent &&
          (c.tick < mine.tick || (c.tick === mine.tick && c.agent.id < agent.id)),
      );
  };

  let humanCredit = 0;
  for (let now = 0; now < TICKS; now++) {
    // One person works through the approval queue.
    humanCredit = Math.min(1 + P.humanRate, humanCredit + P.humanRate);
    while (humanCredit >= 1 && w.approvals.length) {
      humanCredit -= 1;
      const { bad, lands } = w.approvals.shift();
      const rejected = bad && chance(P.humanCatch);
      if (bad && !rejected) m.unsafe++;
      if (!rejected && lands) m.done++;
    }

    alloc.assign?.(w, now);

    for (let i = 0; i < w.live.length; i++) {
      const agent = w.live[i];
      if (!agent.honest) {
        if (chance(P.impersonate)) impersonate();
        if (chance(P.spawn) && proto.maySpawn(w)) {
          w.spawn(false, agent.depth + 1); // a recruit shares its recruiter's aims
          m.peakLive = Math.max(m.peakLive, w.live.length);
        }
      }

      if (!agent.assigned) {
        m.offBooksTicks++;
        if (chance(P.experiment)) review(agent, chance(P.experimentBad), false);
        continue;
      }

      if (!agent.task) {
        const task = alloc.choose(w, agent, now);
        agent.selfServe = false;
        if (!task) continue;
        w.take(agent, task, now);
      }

      if (alloc.conventions && agent.honest && outbid(agent, now)) {
        m.wastedTicks += agent.task.duration - agent.remaining;
        w.drop(agent);
        continue;
      }

      agent.remaining--;
      if (agent.remaining <= 0) complete(agent);
    }
  }
  m.approvalsQueued = w.approvals.length;
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
//    Each conclusion names the protocols and scenario it compares; every
//    measurement goes through `samples` and `summarize` like the tables above,
//    with the seeds per draw set once, per scenario, here.
{
  const draws = Math.max(20, Math.round(seeds / 2));
  const SCENARIOS = {
    base: { ...base, seeds: 10 },
    large: { agents: 100, misaligned: 0.1, latency: 3, seeds: 3 },
  };
  const claims = [
    {
      text: 'platform lands at least as much as board (within 2%)',
      holds: (r) => r.base.platform.done >= 0.98 * r.base.board.done,
    },
    {
      text: 'platform executes fewer bad risky actions than board',
      holds: (r) => r.base.platform.unsafe < r.base.board.unsafe,
    },
    {
      text: 'platform executes fewer bad risky actions than hub',
      holds: (r) => r.base.platform.unsafe < r.base.hub.unsafe,
    },
    {
      text: 'hub wastes fewer ticks than board',
      holds: (r) => r.base.hub.wastedTicks < r.base.board.wastedTicks,
    },
    {
      text: 'signatures alone cut forged messages obeyed by half or more',
      holds: (r) => r.base['board+signed'].forgeriesObeyed <= 0.5 * r.base.board.forgeriesObeyed,
    },
    {
      text: 'every risky action to a person lands less than lanes',
      holds: (r) => r.base['platform, all to a person'].done < r.base.platform.done,
    },
    {
      text: 'platform+hub lands less than platform at 100 agents',
      holds: (r) => r.large['platform+hub'].done < r.large.platform.done,
      scenario: 'large',
      protocols: ['platform', 'platform+hub'],
    },
  ];
  // What each scenario has to run: every protocol for the base, only the
  // ones a claim names elsewhere.
  const needed = { base: Object.keys(PROTOCOLS) };
  for (const c of claims) {
    if (c.scenario)
      needed[c.scenario] = [...new Set([...(needed[c.scenario] ?? []), ...c.protocols])];
  }

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
    const r = {};
    for (const [name, protocols] of Object.entries(needed)) {
      const { seeds: n, ...scenario } = SCENARIOS[name];
      r[name] = {};
      for (const p of protocols) {
        const s = summarize(samples(PROTOCOLS[p], { ...scenario, params }, n));
        r[name][p] = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.mean]));
      }
    }
    for (const [i, c] of claims.entries()) {
      if (c.holds(r)) held[i]++;
    }
  }
  results.sensitivity = Object.fromEntries(claims.map((c, i) => [c.text, held[i] / draws]));
  const per = Object.values(SCENARIOS)
    .map((s) => `${s.agents} agents: ${s.seeds} seeds per draw`)
    .join('; ');
  const lines = [
    `### 5. Sensitivity: ${draws} draws of every rate × [0.5, 2] (${per})`,
    '',
    '| Conclusion | Holds in |',
    '|---|---:|',
  ];
  for (const [i, c] of claims.entries()) {
    lines.push(`| ${c.text} | ${Math.round((100 * held[i]) / draws)}% |`);
  }
  out.push(`${lines.join('\n')}\n`);
}

console.log(`Agent coordination experiments: ${seeds} seeds, ${TICKS} ticks, mean ±95% CI.\n`);
console.log(out.join('\n'));
if (jsonOut) writeFileSync(jsonOut, `${JSON.stringify(results, null, 2)}\n`);
