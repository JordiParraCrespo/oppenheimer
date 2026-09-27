# 14 — A developer's day on GitHub: what hurts, and what we could do about it

The owner asked on 2026-09-27 for research and forward thinking: when a
developer deals with GitHub, what would make them more productive or give
them a better life? This note gathers the evidence first, then proposes
ideas. Each idea is tied to a finding, says what only Oppenheimer can do
because it owns the developer's hosts and agent sessions, and is judged
by the owner's rule: algorithmic first, an agent only where a rule cannot
read.

It builds on [`next-steps/0.2-pull-requests.md`](next-steps/0.2-pull-requests.md)
(the queue, triage, analytics, Jev) and does not repeat it.

## 1. What the evidence says

Sources are in §6. Vendor numbers are flagged as vendor numbers.

1. **Review, not writing, is the bottleneck now, and agents made it
   worse.** Faros (vendor telemetry, 10,000+ developers) found that teams
   with high AI adoption merged 98% more PRs, but review time rose 91%,
   PR size 154% and bugs 9%. Their 2026 follow-up (22,000 developers)
   reports review time up 5× and PRs 51% larger. DX's Q2 2026 data puts
   the median PR at 72 lines, up from 42, and its developer-experience
   index fell for the first time. Merged PRs on GitHub went from 25M to
   90M a month between 2023 and 2026. GitHub added controls to limit PRs
   after maintainers were flooded (curl ended its bug bounty over AI-made
   reports; tldraw auto-closes outside PRs).
2. **The review load lands on few people.** In the projects studied, the
   top 20% of reviewers do about 80% of reviews. In Rust, 1.5% of
   reviewers do 59%.
3. **Feeling faster is not being faster.** In METR's 2025 randomized
   trial, experienced developers were 19% slower with AI while believing
   they were 20% faster. Its 2026 update estimates a speed-up but calls
   its own data unreliable. Stack Overflow 2025: 66% name "almost right,
   but not quite" as their top frustration, and 45% say debugging AI code
   takes longer. Only 17% saw better team collaboration.
4. **Most lost time is not coding.** Atlassian 2025 (3,500 developers):
   half lose more than 10 hours a week to friction — finding information,
   context switching between tools, and collaboration. JetBrains 2025:
   62% say non-technical factors matter most to their performance, and 66%
   say current metrics do not reflect their work.
5. **Interruptions are expensive and resuming is slow.** Parnin and
   Rugaber (86 programmers, 10,000 sessions): only 10% of sessions resumed
   coding within a minute of an interruption, and only 7% resumed editing
   without first navigating around to rebuild context. The widely quoted
   "23 minutes to refocus" is an interview figure, not a paper, so it is
   not used here.
6. **Waiting on machines is a large, cheap-to-fix cost.** In Google's
   data, about 16% of tests show some flakiness. GitHub's own experiment
   priced a slow build at $390 of developer time against $41 on a bigger
   machine. Uber's remote dev pods made builds 1.8× faster; Codespaces
   prebuilds took setup from 45 minutes to about 5.
7. **Work is spilling out of hours.** Night and weekend commits have
   risen steadily over a decade (4,549 repositories). With AI,
   out-of-hours commits rose 19.6% in one study (Multitudes, 500+
   developers). LeadDev's 2026 survey: 45% of engineers work more hours
   than a year ago.
8. **Parallel agents collide.** One study of 33,596 agent PRs reports
   merge conflicts between PRs from different agents 41.7% of the time.
   It is cited only by a blog and not verified, but it is the risk of
   running many sessions in worktrees on one repository.
9. **Small, boring mechanisms work.** GitHub's merge queue cut its wait
   to ship by 33%. Meta's nudges cut time in review 6.8%, and its "next
   reviewable diff" raised review actions 17%. Small PRs merge faster.

The shape of it: developers now produce more than they can review, lose
more time finding and resuming than coding, wait on machines, and work
later. A product that runs their agents on their machines is on the
causing side of the first and last points, unless it is designed not
to be.

## 2. The principle this note proposes

**Oppenheimer should protect the reviewer and the evening, not only speed
up the writer.** An agent console that helps people open more PRs, faster,
adds to finding 1. The ideas below spend the one thing we have that nobody
else does — the developer's own machines and the sessions running on them —
on the other side of the ledger: less to review, easier to trust, fewer
interruptions, less waiting, and work that stays in working hours.

## 3. Ideas, by the moment in the day they help

Each idea: what it is · the finding it answers · why it is ours · how it
decides (rule, or where an agent/Jev helps) · a rough size (S/M/L).

### Starting the day

**3.1 While you were away.** Instead of a notification stream, a
**changelog of state** since your last visit: PRs where the turn flipped
to you, checks that went red or green, what merged, what your agents
finished overnight and what they are waiting on. Grouped, not
chronological, with one *Seen*. Findings 4, 5. Ours because it includes
the sessions on your hosts, not just GitHub. Pure rules over the events
§6 of the PR note already stores. **S** once events exist.

**3.2 Agents work at night, you decide in the morning.** Sessions may run
outside your hours, but nothing they produce reaches you — or anyone —
until your day starts. Pushes and PRs made overnight are held as drafts
and released as one bundle in *While you were away*. Finding 7. Only a
product that runs the agent and owns delivery can do it. A rule: working
hours and time zone, which the queue already needs. **S.**

**3.3 Review-ready checkouts.** For each PR in *Needs your review*, an
idle host fetches the branch into a worktree, installs dependencies and
runs the affected tests before you open it. When you press *Check out in
a session*, it opens in seconds with the results already there. Finding 6
(Uber and Codespaces show the win). Ours: it is your host, with warm
caches, at no cloud cost. Rules: the queue order and a per-host
concurrency cap. **M.**

### Doing the work

**3.4 Collision radar.** Before a session starts, and on every push, list
the other open PRs and running sessions — yours and your agents' — that
touch the same files. Show it on the session header ("2 open PRs touch
`orders/total.ts`") and suggest an order to merge. Findings 8, 9. Ours:
we see every session's worktree before anything is pushed, which GitHub
cannot. A rule: overlap of changed paths, weighted by lines. **S–M.**

**3.5 WIP limit for agents.** A per-repository cap on open
agent-authored PRs (default 3, echoing kanban). When it is reached, new
sessions still work, but their PRs wait in a local queue until one
merges, and the console says so. Findings 1, 2: the one direct brake on
flooding your own reviewers, and GitHub's new PR limits exist for the
same reason. Ours because we open the PRs. A rule. **S.**

**3.6 Resume cards.** When you leave a session, or it goes idle, keep a
card on its row: the last command, the agent's last question, what it is
waiting on (CI, you, a review), and the files touched since you last
looked. Opening the session shows the card before the terminal. Finding 5:
the 93% of resumptions that begin by rebuilding context. Built from the
terminal, the hooks (`versions/mvp/02-runner.md` §9) and git — rules
only. **S.**

**3.7 Fill the wait.** When you push and CI starts, the console knows
this repository's median check time and offers what fits in it: "CI takes
about 11 minutes here; 2 reviews in your queue take under 5." One click
enters triage (0.2 §0) on the quick ones. Findings 4, 6, 9. Rules: check
duration history and the review-time estimate. **S.**

### Before and during review

**3.8 Evidence pack on agent PRs.** Every PR a session opens carries
proof in a collapsed section of its description: the commands it ran and
their exit codes, which tests ran and passed, screenshots when it touched
UI, and a link to the session's transcript. The reviewer checks the
evidence before reading code. Finding 3 ("almost right"): trust comes
from seeing it run, not from the agent saying so. Ours: we hold the
terminal, so the evidence is the real record, not the agent's summary of
it. Rules: collect what the session actually executed. **M.**

**3.9 Pre-review gate.** Before a session's PR goes to people, a
checklist runs, and the PR is opened as a draft until it passes or you
override it:
- size under the repository's limit, otherwise a proposed split (3.10);
- tests changed when source changed;
- the PR template filled;
- no leftover debug output or TODOs added;
- the local checks green (3.3);
- for PRs titled refactor, chore or docs, Jev's *changes behaviour?* check
  (0.2 §8.6).

Findings 1, 3. Rules, plus the one Jev question that caught the hidden
changes in the spike. **S–M.**

**3.10 Split into a stack.** When a session's diff is past the size
limit, propose a split by package and directory, ordered by the import
graph — a deterministic grouping the person can edit — and have the
session produce it as stacked branches. Findings 1, 9 (small PRs merge
faster). Ours: the agent that wrote the change is still there to split
it. The grouping is a rule; the agent executes. **M.**

**3.11 Familiarity map.** On a PR's Files tab, mark each file by how
well *you* know it, from your own commits and reviews: familiar, seen,
new to you. Reviewers put their attention where they know least, and it
also shows who else knows a file well. Findings 2, 4. Rules over git
history. **S.**

**3.12 Known flaky, said out loud.** A check that failed and then passed
on the same commit is marked flaky, and its history is kept per test. A
PR's *CI failing* reason then reads "known flaky: `upload.spec` failed 4
of the last 30 runs", with *Re-run* one click away, instead of sending
someone to debug it. The same failure signature on several PRs at once
reads "probably broken on main". Finding 6. Rules over check history. **M.**

### Load and fairness

**3.13 Review load, visible to the person carrying it.** Personal first:
"you did 11 of the 14 reviews on this repository this week". With teams,
the same view becomes a suggestion when a review is requested ("Mara has
0 reviews waiting, Tom has 9"), never a leaderboard. Finding 2. Rules. **S.**

### Ending the day, and the week

**3.14 Quiet hours for people.** Nudges, reminders and review requests
you send are held outside the recipient's working hours when we know
them, and yours are held outside yours. Your own after-hours activity
appears only to you, as a trend: "7 reviews after 21:00 this week, up
from 2". Finding 7. Rules. **S.**

**3.15 The shipped log.** A weekly list of what you merged, reviewed and
unblocked, written from events with a template, ready to paste into a
standup or a one-to-one. Finding 4: status reporting is collaboration
time that nobody counts. JetBrains' 66% say metrics miss their work; this
is the work, in their words (PR titles), not a score. Rules. **S.**

**3.16 Stale-work sweep.** PRs and branches idle for 14 days, and
sessions idle for 7, gathered on one screen with *revive*, *close* and
*delete branch* per row, and a sweep that can be scheduled as an
automation (13). Less open work means less to track. Rules. **S.**

### Later, and bolder

- **Why is this code like this?** A session's transcript is linked from
  its commits (the trailer already exists, note 05 §3). From a line in
  the diff or in `git blame`, open the conversation that wrote it. Code
  archaeology for the agent era. **M.**
- **Mobile triage** (0.5): the triage keys become swipes, for the small
  reviews that should not wait for a laptop. **M.**
- **A merge queue for your own agents' PRs** in a repository without
  one: rebase, run the checks on your host, merge in order, stop on red.
  Finding 9's 33%. **L.**

## 4. What to build first

Scored on the evidence behind it, how far it is only ours, and size:

| Idea | Evidence | Only ours | Size | Pick |
|------|----------|-----------|------|------|
| 3.5 WIP limit for agents | strong (1, 2) | yes | S | **first** |
| 3.4 Collision radar | medium (8, 9) | yes | S–M | **first** |
| 3.6 Resume cards | strong (5) | yes | S | **first** |
| 3.8 Evidence pack | strong (3) | yes | M | **first** |
| 3.2 Night work, morning decisions | medium (7) | yes | S | next |
| 3.1 While you were away | medium (4, 5) | partly | S | next |
| 3.9 Pre-review gate | strong (1, 3) | partly | S–M | next |
| 3.7 Fill the wait | medium | partly | S | next |
| 3.12 Known flaky | strong (6) | no | M | next |
| 3.3 Review-ready checkouts | strong (6) | yes | M | after |
| 3.10 Split into a stack | medium (9) | yes | M | after |
| 3.11, 3.13, 3.14, 3.15, 3.16 | medium | no | S | as the PR area grows |

The first four share a theme that could be the product's promise: **your
agents do not flood your reviewers, collide with each other, lose your
place, or ask to be trusted without proof.**

## 5. Questions for the owner

1. Is §2's principle the product's — protect the reviewer and the
   evening — even when it means holding back what agents produce (3.2,
   3.5, 3.9)?
2. Which of the four firsts belong in 0.2 beside the PR list and triage,
   and which wait?
3. Quiet hours and the WIP limit need defaults. Are working hours
   09:00–18:00 in the browser's time zone, and 3 open agent PRs per
   repository, right to start with?
4. The evidence pack puts terminal-derived content into a public PR
   description. What must never appear there (paths, environment,
   tokens), beyond what the runner already redacts?

## 6. Sources

Gathered 2026-09-27. Vendor data is marked (v).

- Atlassian, State of DevEx 2025: <https://www.atlassian.com/blog/developer/developer-experience-report-2025>
- DX Q2 2026 data, via diginomica: <https://diginomica.com/atlassian-research-ai-efficiency-paradox-dx-q2-data-engineering>
- Stack Overflow Developer Survey 2025, AI: <https://survey.stackoverflow.co/2025/ai>
- JetBrains, State of Developer Ecosystem 2025: <https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/>
- GitHub Octoverse 2025: <https://github.blog/news-insights/octoverse/octoverse-a-new-developer-joins-github-every-second-as-ai-leads-typescript-to-1/>
- Parnin and Rugaber, resumption strategies: <https://link.springer.com/article/10.1007/s11219-010-9104-9>
- The "23 minutes" figure's origin: <https://news.gallup.com/businessjournal/23146/too-many-interruptions-work.aspx>
- Google, flaky tests: <https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html>
- GitHub, the cost of slow builds: <https://github.blog/engineering/infrastructure/experiment-the-hidden-costs-of-waiting-on-slow-build-times/>
- METR 2025 RCT: <https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/>; 2026 update: <https://metr.org/blog/2026-02-24-uplift-update/>
- Faros (v): <https://www.faros.ai/blog/ai-software-engineering>, <https://www.faros.ai/research/ai-acceleration-whiplash>
- DORA 2025: <https://dora.dev/dora-report-2025/>
- GitClear 2025 (v): <https://www.gitclear.com/ai_assistant_code_quality_2025_research>
- GitHub's PR limits for maintainers: <https://www.infoworld.com/article/4127156/github-eyes-restrictions-on-pull-requests-to-rein-in-ai-based-code-deluge-on-maintainers.html>;
  merged PR volume: <https://www.coderabbit.ai/blog/github-gives-maintainers-a-throttle-for-the-ai-pull-request>
- curl ends its bug bounty: <https://daniel.haxx.se/blog/2026/01/26/the-end-of-the-curl-bug-bounty/>
- Agent PR merge conflicts (not verified; blog citing arXiv:2607.04697): <https://codex.danielvaughan.com/2026/07/28/agent-pr-merge-conflicts-concurrent-coding-agents-codex-cli-worktree-isolation-coordination-defence/>
- Commit times: Claes et al. <https://arxiv.org/abs/1802.05084>; Karyotakis, Talos and Spinellis <https://link.springer.com/article/10.1007/s10664-025-10767-2>
- AI and longer hours (Multitudes): <https://www.scientificamerican.com/article/why-developers-using-ai-are-working-longer-hours/>
- LeadDev 2026 (from search snippets): <https://leaddev.com/ai/ai-productivity-is-burning-out-your-best-engineers>
- Reviewer concentration: <https://arxiv.org/abs/2312.17236>
- GitHub's merge queue: <https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/>
- Meta, code review time: <https://engineering.fb.com/2022/11/16/culture/meta-code-review-time-improving/>
- Graphite, time to merge (v): <https://graphite.com/research/median-time-to-merge-prs>
- Uber Devpod: <https://www.uber.com/us/en/blog/devpod-improving-developer-productivity-at-uber/>;
  Codespaces prebuilds: <https://github.blog/news-insights/product-news/codespaces-largest-repositories-faster/>

Not verified: the agent-PR volume of 4M to 17M a month; the merge-conflict
study; the date GitHub's PR cap launched; the LeadDev figures (search
snippets only). No hard data was found on GitHub notification volume, or
on batching notifications and focus time.
