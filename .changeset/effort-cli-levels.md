---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/runner": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
"@oppenheimer/design-system-web": patch
---

Effort is each CLI's own levels, per model, instead of five product stops.

- **Catalog (`@oppenheimer/shared`):** `SESSION_EFFORTS` is now every level
  name a CLI here takes (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`,
  `max`, `ultra`), and each model row carries `effort: { levels, default }`
  with the levels its CLI offers and the one it runs unasked. `launch.effort`
  is gone; `effortFor(agent, model)` answers for a session. The levels and
  defaults were read off the CLIs: claude's request with no `--effort` (Opus
  and Sonnet `medium`, Fable `high`, Haiku none), `codex debug models` (no
  `minimal` anywhere, `ultra` on Astra, Sol and Terra, Sol defaulting to
  `low`), `opencode models --verbose` and grok's own check.
- **OpenCode takes an effort** as the model's variant, set through
  `OPENCODE_CONFIG_CONTENT` beside the permission block.
- **Runner:** the generated launch table's effort is keyed by model and then
  level, with each agent's default model, and a level's environment is merged
  with the permission level's.
- **API:** a session records only a level its model offers. A migration
  rewrites stored efforts to the level each session and automation revision
  already ran at (Claude Code's stops were shifted one level up; Codex's Max
  ran `xhigh`).
- **Console:** the slider draws the model's levels, starts on its default and
  sends nothing until moved; a pick is remembered per agent, and one the model
  lacks lands on the nearest level below.
