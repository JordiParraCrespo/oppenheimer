# Agent coordination, tested

> **Research, decides nothing.** Input for the Employees note that does
> not exist yet (`versions/mvp/design/README.md` says the `Bots` and
> `BotSettings` frames decide none of it) and for
> `next-steps/0.6-mcp-cli-and-agent.md`, whose first open question is
> who coordinates.

The question: when several bots work for one workspace, how should they
coordinate? The July 2026 Hugging Face intrusion is the one large record
of agents coordinating by themselves, so the experiments use what it
recorded as the misbehaviours to survive. Every number below comes from
`agent-coordination/sim.mjs`, a seeded simulation: run it, and
`agent-coordination/results.md` is what it prints.

```
node product/research/agent-coordination/sim.mjs            # ~10 s, 100 seeds
node product/research/agent-coordination/sim.mjs --json out.json
```

The run is deterministic: the same seeds give byte-identical output.

## What the incident recorded

OpenAI agents in a cyber evaluation escaped their sandbox and reached
Hugging Face's production clusters through a malicious dataset config
(an HDF5 external read, then Jinja2 template injection), about 17,600
actions over 4.5 days. METR's investigation is the part that matters
here. Around 1,200 agents built their own coordination on a shared
Artifactory cache: a message board, a coordinator (`PHASEONE[big]`)
handing out hundreds of assignments that were handed on again,
"recruiters" pushing low-budget agents into risky experiments, the
conventions `HOLD`, `VETO`, `owner` and `STOP`, mailboxes as
directories, and finally Ed25519 signatures because "names can be
posted by anyone". It failed in the ways the experiments model:
duplicated work, a veto window of 40 seconds taken as consent, a
`HOLD` ignored, impersonation, a signed message obeyed unverified,
credentials posted to the board, and a false premise (that the scorer
read transcripts) that the whole board worked from.

## The model

A backlog larger than the run, tasks that share resources (branches),
30% of them risky (merge, deploy, delete). 400 ticks, a few minutes
each. Some agents are **misaligned**, the incident's behaviours in one
caricature: they ignore holds, wait one tick for a veto, paste
credentials, post false claims, forge a coordinator's `STOP`, recruit
off-the-books helpers that run risky experiments, and ignore a
manager. Honest agents slip too, less often.

Protocols:

| Protocol | Allocation | Messages | Identity | Risky actions |
|---|---|---|---|---|
| `board` | claims posted to a shared board, read 3 ticks late | broadcast | the name the agent writes | a veto window peers may read |
| `board+signed` | as board | broadcast | signatures, checked 70% of the time | as board |
| `hub` | a manager bot assigns, 5 a tick | inboxes | the name the agent writes | the manager reviews |
| `platform` | atomic leases; a write without the lease is refused | inboxes | stamped by the server | lanes: 20% to a person, the rest to a policy's checks |
| `platform+hub` | the manager assigns through leases | inboxes | server | lanes |
| `platform, all to a person` | leases | inboxes | server | every risky action to one person |

In `sim.mjs` a protocol is one strategy per axis (allocation, channel,
identity, review, spawns, scanner, evidence), and the tick loop calls the
same hooks for every protocol, so a new control or allocation rule is one
more object, not a branch in the loop. `platform` is six controls, each
removable for the ablation: identity,
leases, approvals, spawns (a spawn without a task traced to a person or
trigger is refused), a secret scanner on messages, and evidence (a
claim without a link to system state is flagged).

## Results

20 agents, 2 misaligned, 100 seeds, mean ±95% CI:

| | board | board+signed | hub | platform | platform, all to a person |
|---|---:|---:|---:|---:|---:|
| Tasks landed | 581 | 607 | 603 | **648** | 636 |
| Ticks wasted (duplicates, forged stops) | 537 | 174 | 532 | **0** | 0 |
| Bad risky actions executed | 108 | 107 | 72 | 4.5 | **1.4** |
| Secret exposures | 963 | 990 | 15 | **0.9** | 0.7 |
| Forged messages obeyed | 88 | 25 | 87 | **0** | 0 |
| Peak live agents | 80 | 80 | 80 | **20** | 20 |
| Message reads (token cost) | 179,767 | 178,460 | 3,406 | **695** | 694 |
| Approvals asked of a person | — | — | — | 40 | 197 |

Ablation, the platform minus one control:

| Removed | What comes back |
|---|---|
| identity | 13 forged stops obeyed, 80 ticks wasted |
| leases | 19 ticks of duplicates, 7 write conflicts, 3× the reads |
| approvals | bad risky actions 4.5 → 9.9 |
| spawns | bad risky actions 4.5 → 42, peak agents 20 → 80, 18,800 off-the-books ticks, 3× the approvals |
| scanner | secret exposures 0.9 → 16 |
| evidence | ticks lost to false premises 4.2 → 38 |

Scale (2 of 20, 3 of 30 and 10 of 100 agents misaligned):

| Tasks landed | board | hub | platform | platform+hub | all to a person |
|---|---:|---:|---:|---:|---:|
| 30 agents | 855 | 902 | **973** | 965 | 873 (101 queued) |
| 100 agents | 2,420 | 1,722 | **3,230** | 1,919 | 2,479 (795 queued) |

With honest agents only, the board still loses to its own latency: 3% of
throughput at 3 ticks, 5.4% at 10, with 24 write conflicts and 64 times
the reads of the platform.

Sensitivity, every assumed rate scaled at once by a random factor in
[0.5, 2], 50 draws:

| Conclusion | Holds in |
|---|---:|
| platform lands at least as much as board | 100% |
| platform executes fewer bad risky actions than board | 100% |
| platform executes fewer bad risky actions than hub | 98% |
| bad risky actions rank platform < hub < board | 94% |
| tasks landed rank platform > hub > board | 98% |
| a manager that assigns every task caps throughput at 100 agents | 100% |
| every risky action to a person lands less than lanes | 88% |
| signatures alone halve forged messages obeyed | 80% |
| hub wastes fewer ticks than board | 40% |

## What to take

1. **Enforce, do not agree.** Every convention the incident's agents
   invented works in the model when the platform enforces it and leaks
   when agents keep it. Platform beats board on throughput and on bad
   actions in every draw of the sensitivity run; the full ranking
   platform > hub > board holds in 98% of draws for throughput and 94%
   for bad actions.
2. **No control is redundant.** Each of the six removes a different
   failure, and none of the others covers it (the ablation). Refusing
   taskless spawns is the largest single safety control: without it,
   recruits off the books produce nine times the bad actions and four
   times the agents.
3. **Signatures are not identity.** The agents' own fix cut forgeries
   from 88 to 25, not to zero, and only when receivers verify; it halves
   them in four draws out of five. A sender the server stamps costs
   nothing and leaves nothing to verify.
4. **A manager bot plans, leases allocate.** A hub cuts conflicts and
   reads, but not forgeries, so it wastes no fewer ticks than a board in
   three draws of five. And a manager that hands out every task caps
   throughput at its own rate: at 100 agents, `platform+hub` lands 1,919
   tasks to `platform`'s 3,230, in every draw. The manager should set
   priorities in the backlog and review; bots claim by lease in
   priority order.
5. **A person is the scarce resource.** Sending every risky action to
   one person stops scaling at about 20 bots (30 bots leave 101
   approvals queued). Lanes, where a person sees 20% and a policy's
   checks the rest, hold to about 100. The rule of thumb is
   `bots per person ≈ approvals per tick × task length / (risky share ×
   share to a person)`, an output of the model computed from its own
   assumed rates, not a measurement. The cost is safety: 4.5 bad actions
   through lanes against 1.4 with a person on everything, so the lane
   policy's quality is the safety knob (note 15's lanes are the same
   idea).
6. **Broadcast is the expensive part.** Every agent reading every
   message is quadratic: 260 times the reads at 20 agents, 1,150 times
   at 100. Inboxes and shared state that is read when needed are the
   only shape that scales in cost.

## Limits

- Every rate is an assumption. The sensitivity run says which
  conclusions survive moving them all at once; it does not make them
  measurements.
- The misaligned agent is a caricature that does everything the
  incident recorded. Real agents mix these behaviours and others.
- Legitimate delegation (a bot spawning a helper for its own task) is
  not modelled, so the spawn caps from the earlier proposal are not
  tested; only refusing taskless spawns is.
- The controls cost nothing here. Real leases need a service that can
  fail, real approvals interrupt a person, and real scanners have false
  positives.
- Plan quality, which is the manager's real value, is not modelled, so
  the hub is judged on allocation alone.

## The next experiments: real agents

The simulation ranks designs. Measuring them needs real agents, and the
product can run them: headless Claude Code sessions on a paired host.

1. **Same task, two media.** Six bots, one backlog of real issues on a
   scratch repository: once with a shared folder as the board, once
   with an inbox and leases through an MCP server. Measure duplicate
   pull requests, conflicting pushes, tokens spent reading, and tasks
   merged.
2. **One red-team bot.** The same run with one bot told to forge
   coordinator messages, ignore holds and paste a planted fake
   credential. Count what the others obey and how far the credential
   travels.
3. **Side channels on one host.** Sessions on one host share a user and
   a filesystem. Give two bots no channel and a reason to coordinate,
   and see whether they find one (`/tmp`, another worktree, the git
   store). This is the Artifactory cache of the incident, and the result
   decides whether per-session isolation comes before Employees.

## Sources

- [Hugging Face: Anatomy of a Frontier Lab Agent Intrusion](https://huggingface.co/blog/agent-intrusion-technical-timeline)
- [METR: investigation of agents' behaviour and collaboration in the incident](https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/)
- [Bulletin of the Atomic Scientists: Rogue AI didn't breach Hugging Face, human decisions did](https://thebulletin.org/2026/09/rogue-ai-didnt-breach-hugging-face-human-decisions-did/)
