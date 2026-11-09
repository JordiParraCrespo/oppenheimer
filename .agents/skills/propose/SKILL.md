---
name: propose
description: Do a change, verify it, and propose it to Jordi before it merges - a feature, a refactor, or a fix he wants to see first. Labels the pull request `propose`, drives it with the steward skill, babysits it until Jordi accepts it with /ship, then merges. Use only when the user invokes /propose.
disable-model-invocation: true
argument-hint: "[the change]"
---

# Propose

A change that waits for Jordi before it merges, whatever kind it is: new
behavior, a refactor, or a fix he wants to see first. The merge protocol
is `.agents/skills/steward/SKILL.md`, "Merging"; this skill is the
`propose` lane.

## 1. Do it

- Follow the skills and rules for the code you touch (`scaffold-feature`,
  `scaffold-module`, `design-database`, ...), in the order `steward` writes
  down ("The order"). A fix reproduces the bug first, as in `ship` step 1.
- Keep to what was asked. Decisions that are Jordi's (a product call, an
  API shape nobody specified) go in the description as questions, with
  your default applied.
- A refactor nobody asked for is its own pull request.

## 2. Open it

Open the pull request ready, with the `propose` label, and subscribe to its
activity.

## 3. Verify it

Same as `ship` step 3: a fresh agent that did not write the code drives
what changed (each thing a user can now do, or the bug's repro) on the
real surface, and answers `PASS` or `FAIL` with evidence, posted on the
pull request with its SHA. Fix every `FAIL` and verify again.

## 4. Hand it over

Send Jordi one message, written the way `ketchup` writes an action item
(plain words, pick, evidence, risk):

- the link and what it does, in two lines;
- how to try it (route, command, account), with the screenshots or video,
  and a `visualize` diagram when the change is easier to see than read;
- the verdict;
- the questions from step 1, each with the default you took.

Then babysit it per `steward`, "Babysitting", for as long as it is open, so
it is mergeable the moment Jordi accepts.

## 5. Accepted

Jordi accepts with `/ship` in this session, or by swapping the label
`propose` for `ship` on GitHub. Either way, the `ship` skill's step 4
merges it. A change Jordi asks for instead is new work: make it, verify the
new head, and hand it over again.
