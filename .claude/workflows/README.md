# Workflows

Saved Claude Code workflows: scripts the `Workflow` tool runs by name
(`Workflow({ name: "<file name>", args })`), each fanning work out to
subagents.

| Workflow | Used by | What it does |
| --- | --- | --- |
| [`verify-pr`](verify-pr.js) | the `ship` skill, step 4 | Verifies one pull request head with agents that did not write it: gates, a live lane on the local stack, audit lenses with a skeptic per finding. Returns `PASS`, `PASS+NOTES`, `FAIL` or `BLOCKED`. |

Biome skips this folder (`biome.json`): the runner executes a script's body
as the inside of an async function, so it ends in a top-level `return`, which
no JavaScript parser accepts as a module. To check a script parses, wrap it:

```sh
{ echo '(async () => {'; sed 's/^export const meta/const meta/' .claude/workflows/verify-pr.js; echo '})'; } > /tmp/wf.js && node --check /tmp/wf.js
```
