# 16 — The developer-tools landscape, September 2026

The owner asked on 2026-09-28 for research into other developer
productivity tools. This note maps five groups against Oppenheimer:
AI code review, agent consoles, PR workflow and merge, engineering
analytics, and dev environments. It ends with what to take and where we
stand. It feeds the Pull requests area
([`next-steps/0.2-pull-requests.md`](next-steps/0.2-pull-requests.md))
and note 15's lanes, auto-merge and review sessions.

Numbers a vendor published about itself are marked (v). Claims found
only in an aggregator or a blog are marked (u), for unverified. Sources
are in §8.

## 1. AI code review

| Tool | What it does on a PR | Runs code? | Approves? | Learns? | Price |
|------|----------------------|------------|-----------|---------|-------|
| **CodeRabbit** | Walkthrough, cohort table, sequence diagrams, priority, effort, merge risk, inline comments, chat | Sandboxed pre-merge checks (shell, docs, MCP) | No | *Learnings* from dismissed or corrected comments | $24 / $48 / $72 per seat. $143M Series C at $1.5B (Aug 2026) |
| **Greptile** | Review with the whole codebase indexed | No | No | — | $30 per seat for 50 reviews, then $1 each. Top of Martian's benchmark in Jul 2026 at 60.8% F1 (v) |
| **Graphite Agent** (Cursor) | AI review inside stacked PRs and a stack-aware merge queue | No | No | — | $20 / $40 per seat. Acquired by Cursor in Dec 2025 |
| **Cursor Bugbot** | Bug-finding review with rules in `.cursor/BUGBOT.md` | *Autofix* launches a cloud agent that pushes a fix | No | Learned rules, `@cursor remember` | About $1–1.50 per run since May 2026 |
| **GitHub Copilot review** | Agentic review plus CodeQL and linters, with an "approval assessment" | No | **Yes, since 2026-09-01.** Off by default, path-scoped, counts toward branch protection | — | In Copilot plans |
| **OpenAI Codex review** | `@codex review`, rules in `AGENTS.md`, P0/P1 only (u) | The docs say it does not execute | No | — | In Codex plans |
| **Claude Code Review** | Parallel agents with a verification pass. Findings on 54% of PRs, under 1% marked wrong (v) | No | **Explicitly not** | — | About $15–25 per review |
| **Macroscope** | *Approvability*: ownership, eligibility against a readable policy file, then correctness | No | **Yes, by policy.** Claims 40% of PRs (v, u) | — | — |
| **Baz** | Spec reviewer checks the PR against Jira and Figma | **Runtime checks in a browser** | No | Custom reviewers learned from past PR threads | — |
| **Sourcery** | Summary with risk, reviewer's guide, a status check that gates merge | No | Gates merge | — | $12 / $24 (u) |
| **Qodo 2.0** | Multi-agent: critical issues, duplication, ticket compliance | No | No | Central rules | PR-Agent donated as open source |
| **Linear Diffs** | Review inside Linear. *Guided Reviews* show the core change first and set glue code apart | No | No | — | Business and Enterprise |

Also: Gemini Code Assist, Amazon Q (preview) and Bito review on GitHub.
Ellipsis pivoted to managed cloud agents. Korbit is shutting down.

**Where this leaves us:**

- **Almost all of them read the diff.** Only CodeRabbit's sandboxed
  checks, Baz's browser checks and Bugbot's Autofix run anything, and
  none does *check out, build, run the tests and the app, then report* as
  its core review. Note 15's prepared review session, on the user's own
  host with their toolchain, is still open ground.
- **Auto-approve by readable policy is now real.** Macroscope keeps its
  policy in a file in the repository (`.macroscope/approvability.md`).
  Its defaults — docs, tests, code behind a disabled flag and simple
  fixes approved; migrations, auth, billing and infra escalated — are
  almost exactly note 15 §4.2. Copilot's approval is path-scoped.
  Neither acts in the user's name, and neither ran the code.
- **Effort and risk.** CodeRabbit shows both (the owner's screenshot,
  note 15 §5.3), and Sourcery shows risk. Nobody explains how they
  derive them. Ours are a formula and a gate, and the brief says so.
- **Learning from the reviewer** is table stakes: CodeRabbit's
  Learnings, Bugbot's remembered rules, Baz's reviewers trained on past
  threads. Note 15 does not have it yet (§6.1 below).
- **Benchmarks** move month to month: Greptile, cubic and CodeRabbit have
  each topped Martian's F1 board in 2026. By late 2025, AI bots took part
  in 14.9% of 40.3M public PRs (u).

## 2. Agent consoles: our category

| Tool | Shape | Notable | Status |
|------|-------|---------|--------|
| **Orca** (Stably) | Desktop app: any CLI agent in worktrees | WebGL terminal, an embedded browser with a design mode, inline diff comments sent to the agent, SSH remote worktrees, a mobile companion, a CLI agents use to drive it | MIT, free. **Our closest analogue** (note 00) |
| **Superset** | Electron IDE for agents | Sidebar status (working, needs input, done) with chimes and dock badges; any machine over SSH as a host that keeps running while the laptop sleeps; automations that open PRs; mobile | Free to start |
| **Conductor** | Mac app, one worktree workspace per task | Linear and GitHub issues as context, then diff, review and PR in one place | Free. $22M Series A (u) |
| **Codex app** (OpenAI) | Desktop, worktree isolation | Review queue, local Automations, a PR review pane with GitHub comments inline | 8M weekly users. OpenAI is acquiring Ona |
| **GitHub Copilot app** | Desktop control centre (Jun 2026) | Worktree per session. **"My Work"**: sessions, issues, PRs and automations in one view | New |
| **Cursor 2–3** | Up to 8 parallel agents, then an Agents Window | Cloud agents with computer use; creates, reviews and ships PRs in Graphite | — |
| **Sculptor** (Imbue) | Claude Code in containers | *Pairing mode*: two-way sync of an agent's worktree into your IDE | MIT, beta |
| **Warp Oz** | Cloud agents | Triggered by webhook, cron or CI event ("fix a test that flaked twice this week"), with an audit record | Client open-sourced in Apr 2026 |
| **Claude Squad** | Go TUI on tmux and worktrees | The same architecture as our runner | About 8.4k stars |
| **Coder Agents**, **Ona** | Agents on your own infrastructure | Picks a template, provisions a workspace, runs the task | Coder Tasks retired in v2.37. Ona is being bought by OpenAI |
| **Devin**, **Factory**, **Jules**, **Amp**, **Charlie** | Hosted agents | Charlie's point: the bottleneck is now supplying tasks to agents | Factory $150M Series C. Jules GA with daily task quotas |

**Where this leaves us:** local worktree-plus-tmux orchestration is
crowded and being commoditised by OpenAI, GitHub and Cursor. Terragon
(shut down in Jan 2026, open-sourced) and Bloop's Vibe Kanban (the
company closed, the project is community-run) show that the console
alone is a hard business. What is not crowded:

- **A browser console over hosts you own, with sessions that outlive the
  laptop.** Orca and Superset reach remote machines only over SSH from a
  desktop app.
- **The back half: the PR.** LinearB's 2026 benchmarks (8.1M PRs) show
  agent PRs waiting **17.6 hours** for review against 3.4 hours for
  unassisted ones, and only **32.7%** merging within 30 days against
  84.4%. Agents produce PRs faster than anyone reviews them. That gap is
  the Pull requests area's reason to exist.

## 3. PR workflow and merge

- **GitHub itself** is closing gaps fast:
  - native stacked PRs (`gh-stack`, public preview since 2026-07-30),
    with partial merges, cascading rebases and merge-queue support;
  - **Agent Merge** (preview 2026-09-04), which resolves review
    feedback, failing checks and conflicts until a PR is ready;
  - "Fix with Copilot" for conflicts.
- **Graphite** (Cursor): stacks, AI review and a merge queue in one.
- **Aviator:** a stack-aware queue that validates a stack as one unit
  and can merge part of it.
- **Trunk:** a merge queue that spots flaky tests in-flight, quarantines
  them and keeps merging. An agent that fixes flakes is on its roadmap.
- **Mergify:** queue, CI and test insights, and stacks. Free up to 5
  contributors, then $21 per active contributor.
- **Sapling / ReviewStack, ghstack, spr:** one PR per commit.
  ReviewStack shows only the commit under review.
- **Pullpo, Axolo:** a Slack channel per PR. Pullpo adds AI summaries
  (note 15).

## 4. Engineering analytics

Every analytics vendor now sells **AI impact**:

- **Swarmia:** metrics per AI tool (Copilot, Cursor, Claude Code, Codex),
  plus agent metrics and an AI cost and ROI tab (Aug 2026). Median PR
  size roughly doubled from Q1 2025 to Q1 2026.
- **DX:** now Atlassian's, bought for $1B. A Leader in Gartner's first
  quadrant for developer-productivity platforms.
- **Jellyfish:** 20M PRs. At top adopters, nearly half of PRs are opened
  by agents.
- **LinearB:** the 17.6-hour figure above.
- **Faros:** 98% more PRs but flat company-level output.
- **Span:** a classifier that guesses whether code was AI-written, >95%
  claimed (v).

**Where this leaves us:** they all have to *guess* which PRs an agent
wrote, or ask each tool's API. We **know**, because the session that
opened the PR is ours. The split between human and agent work in 0.2 §5
is exact where theirs is inferred, and cost per merged PR is within reach
from the session's own token and host-time records.

## 5. Dev environments and CI

- **Sandboxes are funded infrastructure:** Modal ($355M at $4.65B,
  sandboxes over a third of revenue), E2B (about 1B sandboxes run),
  Daytona (about $0.05 per vCPU-hour).
- **Namespace:** Devboxes are persistent machines for people and agents,
  and serve as self-hosted sandboxes for Claude Managed Agents.
- **Depot CI:** 2–3 second job starts. **Blacksmith:** 60–75% cheaper
  Actions runners. GitHub has charged $0.002 a minute for self-hosted
  runners since March 2026.

**Where this leaves us:** these are the alternative to our model. They
rent a clean machine per task; we use the developer's own warm machine,
at no cloud cost. That is what makes a *prepared* review session cheap
enough to run for every PR (note 15 §5.1).

## 6. What to take

Each item is tied to the tool it comes from and the note it changes.

1. **Learn from the reviewer** (CodeRabbit Learnings, Bugbot remember,
   Baz custom reviewers). When the person drops, edits or keeps a
   drafted finding (note 15 §5.3), store it as a rule on the repository's
   review automation. The next review's context pack includes the rules.
   Readable, editable, and in the repository if the person wants.
2. **The policy as a file in the repository** (Macroscope). Note 15
   §4.2's auto-merge policy can live in `.oppenheimer/review.md` as well
   as in the console, so it is reviewed like code and travels with the
   repository.
3. **A ready-to-merge agent** (GitHub Agent Merge, Bugbot Autofix). On any
   PR stuck in *Your PRs, back to you*, one key starts a session that
   answers the threads, fixes the failing check and resolves the
   conflict, then puts the PR back in the queue. This is 0.2 §4's *Fix in
   its session*, widened to any PR.
4. **Attention states on sessions** (Superset): working, needs input,
   done, with a sound and a badge. The runner's hook-based state
   detection already exists (`versions/mvp/02-runner.md` §9).
5. **One "My Work" inbox** (Copilot app, Codex review queue): sessions
   waiting on you, PRs where it is your turn and automation output, in
   one triage list. The queue's turn rules extend to sessions.
6. **Flaky tests in the queue** (Trunk): note 15 §6.4, plus a session
   sent to fix a flake that crosses a threshold.
7. **Stack-aware lanes** (Aviator, gh-stack, ReviewStack): a stack is
   laned and reviewed commit by commit, and can auto-merge in part.
8. **Event-triggered sessions** (Warp Oz, Codex Automations): a failed
   check, a flaky test or an error alert starts a prepared session on a
   host. It is an automation trigger (13).
9. **Guided reading order** (Linear Guided Reviews): confirms note 15
   §5.3's code-computed reading order, with glue code set apart.
10. **Mobile approvals** (Orca, Superset, Nimbalyst): the Quick lane on a
    phone. It belongs to 0.5.

## 7. Where we stand

Nobody else combines all four of these:

- the developer's **own hosts**, reachable from a **browser**;
- sessions that **survive the laptop closing**;
- a review that **ran the code** on that host;
- merges **in the user's name**, under a policy they can read.

Each piece exists somewhere: Orca and Superset have the sessions,
CodeRabbit and Baz have fragments of running code, Macroscope and
Copilot have policy approval. The risk is the same list read the other
way. GitHub (Agent Merge, gh-stack, the Copilot app) and Cursor
(Graphite) are shipping these pieces into platforms people already pay
for, so the lead is in integration and in the host, not in any single
feature.

## 8. Sources

Gathered 2026-09-28.

**AI review**
- CodeRabbit: <https://www.coderabbit.ai/pricing>,
  <https://docs.coderabbit.ai/pr-reviews/pre-merge-checks>,
  <https://www.coderabbit.ai/newsroom/coderabbit-series-c-agentic-change-management>
- Greptile v4 and Martian: <https://www.greptile.com/blog/greptile-v4>,
  <https://www.greptile.com/content-library/greptile-martian-code-review-benchmark>
- Graphite Agent: <https://graphite.com/blog/introducing-graphite-agent-and-pricing>;
  Cursor acquisition: <https://cursor.com/blog/graphite>
- Bugbot: <https://cursor.com/docs/bugbot>,
  <https://cursor.com/blog/may-2026-bugbot-changes>
- Copilot review: <https://github.blog/changelog/2026-03-05-copilot-code-review-now-runs-on-an-agentic-architecture/>,
  <https://github.blog/changelog/2026-09-01-copilot-code-review-can-now-approve-pull-requests/>
- Codex review: <https://learn.chatgpt.com/docs/third-party/github>
- Claude Code Review: <https://claude.com/blog/code-review>
- Macroscope Approvability: <https://macroscope.com/blog/introducing-approvability>;
  its benchmark: <https://macroscope.com/blog/code-review-benchmark>
- Baz: <https://aws.amazon.com/blogs/machine-learning/how-baz-improved-its-ai-agent-code-review-accuracy-using-amazon-bedrock-agentcore/>,
  <https://baz.co/resources/turn-past-prs-into-code-review-agents-introducing-custom-reviewers-by-baz>
- Sourcery: <https://docs.sourcery.ai/Code-Review/Overview/>
- Qodo 2.0: <https://devops.com/qodo-adds-multiple-ai-agent-to-code-review-platform/>
- Linear Diffs: <https://linear.app/changelog/2026-05-27-linear-diffs>
- Bot share of public PRs (u): <https://dev.to/zak_mandhro/github-copilot-crushed-every-code-review-startup-40m-pr-analysis-2no6>

**Agent consoles**
- Orca: <https://www.onorca.dev/>
- Superset: <https://superset.sh/>, <https://github.com/superset-sh/superset>
- Conductor: <https://www.conductor.build/docs/>
- Codex app: <https://codex.danielvaughan.com/2026/04/17/codex-app-workspace-pr-review-task-sidebar-artifact-viewer/>;
  weekly users: <https://thenewstack.io/gpt-5-6-codex-user-surge/>;
  Ona: <https://www.forbes.com/sites/janakirammsv/2026/06/13/openai-buys-ona-to-run-codex-agents-inside-enterprise-clouds/>
- Copilot app: <https://www.helpnetsecurity.com/2026/06/08/github-copilot-app-ai-coding-agents/>
- Cursor 2.0: <https://cursor.com/changelog/2-0>
- Sculptor: <https://imbue.com/sculptor/>
- Warp: <https://www.warp.dev/newsroom/2026/4/28/warp-open-sources-its-agentic-development-environment>
- Terragon shutdown: <https://github.com/terragon-labs/terragon-oss>
- Vibe Kanban: <https://www.vibekanban.com/blog>
- Claude Squad: <https://github.com/smtg-ai/claude-squad>
- Coder Agents: <https://www.infoq.com/news/2026/05/coder-agents-self-hosted-ai/>
- Factory: <https://factory.ai/news/series-c>
- Charlie Labs: <https://charlielabs.ai/blog/the-task-supply-problem/>

**PR workflow and merge**
- gh-stack: <https://docs.github.com/en/pull-requests/get-started/about-stacked-prs>
- Agent Merge: <https://github.blog/changelog/2026-09-04-github-copilot-weekly-releases-august-31/>
- Aviator stacks: <https://docs.aviator.co/mergequeue/how-to-guides/merging-stacked-prs>
- Trunk flaky tests: <https://trunk.io/blog/stop-flaky-tests-from-sabotaging-your-merge-queue>
- Mergify pricing: <https://mergify.com/pricing>
- ReviewStack: <https://sapling-scm.com/docs/addons/reviewstack/>

**Analytics**
- LinearB 2026 benchmarks: <https://linearb.io/resources/software-engineering-benchmarks-report>
- Swarmia AI ROI: <https://www.swarmia.com/changelog/2026-08-07-ai-roi/>
- DX in Gartner's quadrant: <https://getdx.com/report/dx-named-a-leader-gartner-magic-quadrant-developer-productivity/>
- Jellyfish: <https://jellyfish.co/newsroom/jellyfish-reveals-ais-real-impact-on-engineering-teams/>
- Span: <https://www.businesswire.com/news/home/20250916147051/en/Span-Launches-Universal-AI-Code-Detector-to-Help-Technology-Leaders-Measure-the-Adoption-and-Impact-of-AI-assisted-Coding>

**Dev environments and CI**
- Modal: <https://modal.com/blog/modal-series-c>
- Namespace Devboxes: <https://namespace.so/blog/claude-managed-agents-on-devboxes>
- Depot CI: <https://depot.dev/changelog/2026-03-24-depot-ci-now-available>
- Blacksmith: <https://www.unite.ai/blacksmith-raises-funding-for-ai-code-validation-layer/>

Not verified: Orca's star count, Conductor's round, Factory's later
valuation, Macroscope's 40%, Devin's revenue, Codex review's P0/P1-only
rule, and whether Codex review executes code (its docs and its launch
post disagree).
