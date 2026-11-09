---
name: research
description: Research a question, write it up as a product note, optionally with a proof of concept, and merge it as soon as its own checks pass. Labels the pull request `research`. Use only when the user invokes /research.
disable-model-invocation: true
argument-hint: "[the question]"
---

# Research

Research is cheap to merge and slow to wait on, so it does not wait. The
merge protocol is `.agents/skills/steward/SKILL.md`, "Merging"; this skill
is the `research` lane.

## 1. Do it

- Answer the question with evidence: sources read, code read, things run.
  Say which claims are measured, which inferred.
- Write the note where `product/README.md` says research goes, and follow
  its rules for a note (a decision that changes another note updates that
  note and the "decisions that changed" list).
- A proof of concept keeps its code beside the note, in
  `product/research/<topic>/`, outside the workspace. Code that has to land
  in `apps/` or `packages/` to work is a feature: say so and stop; Jordi
  can `/propose` it.

## 2. Merge it

- Commit, run `pnpm ci:local`, push on green, and open the pull request
  ready, with the `research` label and the report.
- Merge it yourself as soon as it is green, as `ship` step 4 merges,
  without its verdict.
  No verifier and no wait: nothing in it ships to users. Review comments that arrive later are answered in a
  follow-up pull request.
- Tell Jordi: the link, the answer in a few lines, and what it recommends
  doing next.
