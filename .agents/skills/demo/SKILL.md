---
name: demo
description: Build a feature, verify it, and hand it to Jordi to try before it merges. Labels the pull request `demo`, drives it with the steward skill, babysits it until Jordi accepts it with /ship, then merges. Use only when the user invokes /demo.
disable-model-invocation: true
argument-hint: "[what to build]"
---

# Demo

A feature waits for Jordi before it merges. The merge protocol is
`.agents/skills/steward/SKILL.md`, "Merging"; this skill is the `demo`
lane.

## 1. Build it

- Follow the skills and rules for the code you touch (`scaffold-feature`,
  `scaffold-module`, `design-database`, ...), in the order `steward` writes
  down ("The order").
- Keep to what was asked. Decisions that are Jordi's (a product call, an
  API shape nobody specified) go in the description as questions, with
  your default applied.

## 2. Open it

Open the pull request ready, with the `demo` label, and subscribe to its
activity.

## 3. Verify it

Same as `ship` step 3, with the feature in place of the bug: a fresh agent
that did not write the code drives each thing a user can now do, on the
real surface, and answers `PASS` or `FAIL` with evidence, posted on the
pull request with its SHA. Fix every `FAIL` and verify again.

## 4. Hand it over

Send Jordi one message:

- the link and what it does, in two lines;
- how to try it (route, command, account), with the screenshots or video;
- the verdict;
- the questions from step 1, each with the default you took.

Then babysit it per `steward`, "Babysitting", for as long as it is open, so
it is mergeable the moment Jordi accepts.

## 5. Accepted

Jordi accepts with `/ship` in this session, or by swapping the label `demo`
for `ship` on GitHub. Either way, the `ship` skill's step 4 merges it. A
change Jordi asks for instead is new work: make it, verify the new head,
and hand it over again.
