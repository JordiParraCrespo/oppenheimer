---
name: cook
description: Take a task, pick its lane (ship, propose or research) and run that skill, so Jordi does not have to choose. States the lane and why before any work, defaults to propose when unsure. Use it at the start of every task that will change the repository or open a pull request, whether or not the user typed /cook; skip it only when the user named a lane themselves (/ship, /propose, /research) or only asked a question.
argument-hint: "[the task]"
---

# Cook

The router over the three lanes in `.agents/skills/steward/SKILL.md`,
"Merging". It picks one and runs that skill; it adds no steps of its own.
Every lane runs in the style `jordi-mode` sets.

## 1. Pick the lane

Read the task, the conversation and, when it names one, the code or pull
request it points at. Then:

| The task is | Lane |
| --- | --- |
| behavior that worked, or was meant to, and is broken now | `ship` |
| new or changed behavior, a screen, an endpoint, a refactor | `propose` |
| a question to answer, an option to evaluate, a proof of concept | `research` |
| anything else, or two of these at once | `propose` |

`ship` merges without asking Jordi, so it needs a clear bug: something a
user or a test can see failing. When in doubt, `propose`: the cost of a
wrong `propose` is a wait, the cost of a wrong `ship` is an unreviewed
merge.

## 2. Say it

Before any work, one line: the lane and why, as in
"Lane: `ship`, the session chat jumps on open since #605." Jordi can
override it at any point ("make it a proposal"); switch lanes and say so.

## 3. Run it

Open a todo list with the chosen skill's steps copied in, in order, then
follow that skill (`ship`, `propose` or `research`) as if it had been invoked
with this task. A step you skip stays in the list with its reason.

A lane can still change on the way: `ship` turns into `propose` on its own
terms, and `research` stops when its proof of concept needs product code.

## 4. Recap

When the task ends (the lane's last step is done, or the work stops),
the last message is the `recap` skill, in place of the lane's own "tell
Jordi" message.
