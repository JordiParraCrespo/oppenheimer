---
name: cook
description: Take a task, pick its lane (ship, demo or research) and run that skill, so Jordi does not have to choose. States the lane and why before any work, defaults to demo when unsure. Use only when the user invokes /cook.
disable-model-invocation: true
argument-hint: "[the task]"
---

# Cook

The router over the three lanes in `.agents/skills/steward/SKILL.md`,
"Merging". It picks one and runs that skill; it adds no steps of its own.

## 1. Pick the lane

Read the task, the conversation and, when it names one, the code or pull
request it points at. Then:

| The task is | Lane |
| --- | --- |
| behavior that worked, or was meant to, and is broken now | `ship` |
| new or changed behavior, a screen, an endpoint, a refactor | `demo` |
| a question to answer, an option to evaluate, a proof of concept | `research` |
| anything else, or two of these at once | `demo` |

`ship` merges without asking Jordi, so it needs a clear bug: something a
user or a test can see failing. When in doubt, `demo`: the cost of a wrong
`demo` is a wait, the cost of a wrong `ship` is an unreviewed merge.

## 2. Say it

Before any work, one line: the lane and why, as in
"Lane: `ship`, the session chat jumps on open since #605." Jordi can
override it at any point ("make it a demo"); switch lanes and say so.

## 3. Run it

Open a todo list with the chosen skill's steps copied in, in order, then
follow that skill (`ship`, `demo` or `research`) as if it had been invoked
with this task. A step you skip stays in the list with its reason.

A lane can still change on the way: `ship` turns into `demo` on its own
terms, and `research` stops when its proof of concept needs product code.
