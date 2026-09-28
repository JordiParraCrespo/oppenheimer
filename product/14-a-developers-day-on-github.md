# 14 — Reviewing at the speed agents write

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

The shape of it: developers now produce more than they can review, and
they lose more time finding context and resuming than coding. This note
does not answer that by writing less. It answers it by **reviewing
faster, with the context already gathered, and by taking the easy PRs out
of human review altogether.**

## 2. The principle (owner, 2026-09-27)

This section exists to make you **review what matters, fast, with the
right context in front of you, and let everything easy through without
you.** It is a tool for people who push hard. It does not slow agents
down, cap them or hold their work back. Throughput is the point, and the
reviewer is the bottleneck, so the product goes after the bottleneck.

The first version of this note proposed the opposite: WIP limits on agent
PRs, quiet hours, overnight holds, "protect the evening". The owner
rejected that on 2026-09-27, and the change is recorded in `README.md`'s
decisions that changed.

Three moves follow from it:

1. **Sort every PR into a lane** by how much human attention it needs:
   none, a glance, or a real review (§3).
2. **Take the "none" lane off your plate** with auto-merge. Rules you can
   read decide it, a session that ran the code verifies it, and the
   policy is proven on your history before it is switched on (§4).
3. **Make the real reviews fast** with a review session prepared on your
   host before you open the PR: the checkout built, the tests run, the
   context loaded and a brief waiting (§5).

## 3. Three lanes

Every PR lands in exactly one lane, and **Jev decides which** (owner,
2026-09-27). The lane is one `choice` question with three options, asked
over the PR's state — title, commits, paths, the diff hunks
(`next-steps/0.2-pull-requests.md` §8.6) — together with facts code has
already computed and passed in as context: size, the paths that match
the repository's risky list, check status, and whether the PR is only
docs, tests or formatting. Jev weighs them and code does not override
it. Below the confidence gate (0.9), the PR goes one lane up: an unsure
*Auto* becomes *Quick*, and an unsure *Quick* becomes *Deep*. The lane is
on the row with Jev's probabilities and the facts it was given.

Every lane gets an agent, sized to the lane (§5):

- **Auto**: a verification run. The agent checks out the PR, runs the
  affected checks, and merges if nothing is found.
- **Quick**: a summary agent. It writes the short brief — purpose, what
  changed, what it ran — that you read before pressing `a`.
- **Deep**: the full review session (§5.1–§5.4).

| Lane | What it means | What you do | Typical PRs |
|------|---------------|-------------|-------------|
| **Auto** | Jev says Auto above the gate, the policy's hard lines hold (§4.2), and the verification run found nothing | Nothing. It merges when green, and you see it in *While you were away* | Docs, tests only, formatting, images, patch dependency bumps, generated files, small refactors that both Jev and the session say change nothing |
| **Quick** | Needs a person, but is small and clear | Read the summary agent's brief, then one key in triage: `a` to approve, `r` to request changes | Small fixes and features outside risky paths, with checks green and no findings |
| **Deep** | Risky paths, large, or the session found something | Open the prepared review session (§5) | Auth, migrations, public APIs, billing, workflows, XL PRs, anything with findings |

Triage (0.2 §0) walks **Quick** first when you have a few minutes, and
**Deep** when you choose to. *Auto* never enters it.

## 4. Auto-merge: the lane that removes reviews

### 4.1 What others do, and what it proves

- **Rules alone work.** One team auto-merges about 15% of its PRs (22 of
  143 in the period described, from 19 contributors). Their rules are no
  public interface changes, no migrations, all checks green, nothing in
  finance code, and no code comments from humans or bots. A GitHub
  Action sweeps every few minutes. They report no incidents and plan to
  widen the rules.
- **gitStream** approves "safe changes" by rule: PRs that are only docs,
  tests, images or formatting. It labels them and says why in a comment.
- **Mergify** merges on conditions written in YAML. Since June 2026 it
  honours "require approval of the most recent push".
- **GitHub Copilot** can submit an approving review that counts toward
  required approvals, since 2026-09-01. It is off by default, controlled
  by admins, **scoped to file paths the admin names**, and dismissed by a
  new push like any other approval.

So auto-merge by rule is established. What nobody else has is the step
between the rule and the merge: a session on a real checkout that ran
the code.

### 4.2 Our policy

Jev picks the lane (§3). The policy is the short list of hard lines an
**Auto** PR must also pass, whatever Jev says. It is read top to bottom
like the turn table (0.2 §3.1), and every line must hold:

1. **Allowed shape.** Any one of:
   - only docs, tests, images or formatting (gitStream's rule);
   - a patch or minor dependency bump from a known bot, lockfile
     included;
   - only generated files, and the session re-runs the repository's own
     generation command and gets the same bytes;
   - a *refactor*, *chore* or *docs* PR where Jev's *changes behaviour?*
     is under 0.1 **and** the session's run agrees: the tests are
     unchanged and green.
2. **No forbidden path.** Migrations, auth, public API or wire contracts,
   CI workflows, billing, and anything the repository adds. The list is
   code, versioned with the policy.
3. **Size** under a limit the repository sets. The default is M (§3.4
   of the 0.2 note).
4. **All required checks green** on the head commit.
5. **The review session's verdict is *no findings***. It ran the
   affected tests locally, and nothing in the diff is left uncovered by
   them.
6. **No open threads**, and no comments from people.

The PR shows the policy's lines ticked, so "why did this merge?" always
has an answer.

### 4.3 Prove it before switching it on

A policy starts in **dry run**. The console replays it over the
repository's last 100 merged PRs and reports something like: "would have
auto-merged 18, of which 0 were reverted or followed by a fix within a
week". The person reads the 18, tightens or loosens a line, and switches
the policy on only when the list looks right. The replay stays on the
policy page as its track record.

### 4.4 When an auto-merge is wrong

After an auto-merge, the console watches the base branch's checks on
their next run. If they go red in a way the merge touched, three things
happen:

- a session opens a revert PR;
- the policy line that let the PR through is marked;
- the repository's next matching PRs go to **Quick** until someone
  looks.

Every auto-merge is in an audit log with its policy version and its
evidence.

### 4.5 Approving and merging, in the user's name

Auto-merge covers **every PR** in the repository that passes (owner,
2026-09-27): ours, our agents', and anyone else's.

**We act in the user's name** (owner, 2026-09-28). The approving review
and the merge are made with the user's own GitHub authorization, the
user-to-server token of the App's install flow (note 09 §1), so on
GitHub they are the user's approval and the user's merge. The review body
carries the lane, Jev's probabilities, the policy lines and the
verification run's evidence, marked as done by Oppenheimer on the user's
behalf.

**If GitHub will not let the merge happen, we wait.** A required approval
the user cannot give — their own PR, including every PR their agents
opened under their account — a required check still pending, a code
owner's review, or a merge queue: the PR stays **Auto**, shows what it is
waiting for, and merges the moment GitHub allows it. No bot identity, no
bypass list, and no rule on the repository is changed to get through.

## 5. The review session

The owner's idea: **a predefined session with all the context, so
reviews are faster.** Only Oppenheimer can build this piece, because it
runs on the developer's own host with their toolchain. The other tools
only read diffs.

### 5.1 Prepared before you open it

Review is an **automation** (13), not a new kind of thing. Its trigger is
*a pull request enters the queue* (opened, ready for review, or a new
push). Its What step is the review, sized by the lane. Its Agent step is
the same one the automation editor already has: agent, model, permission
and effort, **picked by the person**. When a Deep PR's automation runs,
the console starts a review session on your host, in the background:

1. A worktree at the PR's head, with dependencies installed from the
   host's warm cache.
2. The affected checks run locally, using the repository's own
   affected-only command where it has one (this repository's is
   `scripts/ci/affected.mjs`).
3. The app started, when the repository declares how, with a preview URL
   through the host so UI changes can be clicked.
4. The **context pack** loaded into the agent (§5.2).
5. The agent's **review brief** written (§5.3), with its comments drafted
   as a pending review.

When you open the PR, that work is already done. The top of your queue is
prepared first, and how many are prepared at once follows the host's
capacity, the way sessions already do.

### 5.2 The context pack

Code gathers it, so the agent does not have to guess:

- **The PR:** title, description, linked issue, labels, the conversation
  and earlier review threads.
- **The diff and related code:** the callers and importers of every
  changed symbol, and the tests that cover the changed files, found on
  the checkout with the language server or `ripgrep`.
- **History:** the last commits to each changed file. For changed lines,
  `git blame` leads to the PRs that last touched them and their
  discussions, so "why is it like this?" is answered before it is asked.
- **The rules:** the repository's `AGENTS.md`, `REVIEW.md`, `CODEOWNERS`,
  contributing guide and PR template.
- **Checks:** CI results with the failing step, plus the output of the
  local run.
- **For agent PRs:** the authoring session's transcript and its evidence
  pack (§6.3), so the reviewing agent knows what the authoring agent
  tried.

### 5.3 The brief

What you see first, above the diff:

- **Purpose**, in two lines.
- **Reading order:** the core change first, callers next, tests last.
  Code computes this from the import graph; the agent does not choose it.
- **What it ran:** the commands and their results. For example: "Ran the
  `orders` tests: 48 passed. Started the app; checkout with an empty cart
  returns 400."
- **Findings**, each tied to a line, with a severity. They are drafted as
  pending review comments: `enter` keeps one, `e` edits it, `x` drops it.
- **Questions it could not answer.** These are usually the questions for
  the author.
- **The lane**, and why.

Pullpo's AI analysis gives the purpose, the relevant files and
suggestions, from the diff. The brief adds the part that needs a
machine: it ran the code.

### 5.4 Talking to it

The session is a live terminal on a real checkout, beside the diff. The
reviewer asks, and the agent answers by doing:

- "What else calls `total()`?"
- "Run the migration against a copy of the dev database."
- "Try it with an empty cart."
- "Show me this screen on mobile."

A finding the reviewer confirms becomes a review comment with one key.

### 5.5 Review automations per repository

What was called a preset is a **review automation**, built in the
automation editor like any other:

- **Where:** the project and its repositories, and the host.
- **When:** a pull request enters the queue, with the PR filters the
  GitHub trigger already has (note 05 §7): base branch, labels, author,
  draft.
- **What:** the review, with the setup commands, the checks to run, how
  to start the app, and extra review rules. Each lane's agent (§3) is a
  step of it.
- **Agent:** agent, model, permission and effort, picked per automation.
  A cheaper model for the Quick summary and a stronger one for Deep
  reviews is one automation with two steps.

The auto-merge policy's hard lines live on the same automation, so
"how this repository is reviewed" is one page.

## 6. Also worth building

These are kept from the first version because they make the same person
faster:

- **6.1 Collision radar.** Shows the open PRs and running sessions that
  touch the same files, on the session header and on the PR, with a
  suggested merge order. Finding 8. Rules. **S–M.**
- **6.2 Resume cards.** Every session's row shows the last command, the
  agent's last question and what it is waiting on. Finding 5. Rules.
  **S.**
- **6.3 Evidence pack on agent PRs.** The PR carries the commands the
  authoring session ran, the tests and their results, screenshots and a
  link to the transcript. It feeds the reviewer, the review session and
  the auto-merge policy. Finding 3. **M.**
- **6.4 Known flaky.** A check that failed and then passed on the same
  commit is marked flaky, with its history, so *CI failing* reads "known
  flaky, 4 of 30 runs". The same failure across several PRs reads
  "probably broken on main". Finding 6. **M.**
- **6.5 Fill the wait.** While your CI runs, the console offers the
  Quick-lane reviews that fit in its median time. **S.**
- **6.6 Split into a stack.** An XL agent PR is split by package along
  the import graph, and the session that wrote it carries the split out.
  Finding 9. **M.**
- **6.7 While you were away.** The state that changed since your last
  visit, grouped, including what auto-merged and why. **S.**
- **6.8 Familiarity map.** Files are marked by how well you know them,
  from your own commits and reviews. **S.**
- **6.9 Shipped log.** A weekly list of what merged, what you reviewed
  and what auto-merged, built from events and ready for a standup. **S.**

Dropped from the first version, by the owner's call: the WIP limit on
agent PRs, quiet hours, holding overnight agent work until morning, and
review-load fairness as a feature.

## 7. What to build first

| Piece | Why first |
|-------|-----------|
| The review session, prepared (§5.1–§5.3) | The owner's core idea, the largest time saving on every real review, and only ours |
| Lanes, with **Quick** in triage (§3) | Turns the queue from a list into a plan, and needs only rules and Jev's gated answers |
| Auto-merge in **dry run** (§4.2–§4.3) | Proves the number on the owner's own history before anything merges by itself |
| Evidence pack (§6.3) | Feeds all three above |

After those: auto-merge switched on, with the App approving where
approval is required, then the collision radar.

## 8. Decided (owner, 2026-09-27)

1. **Approvals:** we approve and merge in the user's name, with their
   own authorization. When GitHub will not allow it, the PR waits until
   it does (§4.5).
2. **Lanes:** Jev decides the lane. Every lane has an agent: a
   verification run for Auto, a summary for Quick, the full review
   session for Deep (§3).
3. **Review is an automation**, with the agent and model picked in its
   Agent step (§5.1, §5.5).
4. **Auto-merge covers every PR** in the repository that passes (§4.5).

## 9. Sources

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

- Pullpo: <https://pullpo.io/>, docs <https://docs.pullpo.io/>, AI
  analysis <https://docs.pullpo.io/channels-ai>, alerts and reminders
  <https://docs.pullpo.io/channels-notifications>. Pullpo opens a Slack
  channel per PR, posts an AI analysis (purpose, relevant files,
  suggestions), sends CI, commit and approval alerts and stale
  reminders, and sells Insights (cycle time, throughput, change failure
  rate, DevEx surveys) and Conventional Comments. Its site claims a 23%
  cut in cycle time at one customer (vendor).
- Auto-merging 15% of PRs by rule (Swizec Teller): <https://swizec.com/blog/we-now-auto-approve-and-merge-15p-of-prs>
- gitStream, approve safe changes: <https://docs.gitstream.cm/automations/approve-safe-changes/>
- Mergify and the most-recent-push rule: <https://docs.mergify.com/changelog/2026-06-19-merge-protections-honor-githubs-require-approval-of-most-recent-push/>
- Copilot code review can approve PRs (2026-09-01): <https://github.blog/changelog/2026-09-01-copilot-code-review-can-now-approve-pull-requests/>

Not verified: the agent-PR volume of 4M to 17M a month; the merge-conflict
study; the date GitHub's PR cap launched; the LeadDev figures (search
snippets only). No hard data was found on GitHub notification volume, or
on batching notifications and focus time.
