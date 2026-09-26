# @oppenheimer/design-system-web

## 0.2.0

### Minor Changes

- 1a51afc: Rebrand onto the Alpaca Labs visual language: monochrome-first, flat tokens with `globals.css` as the single source of truth, sixteen new components, five chat primitives, and every overlay brought onto the brand's metrics.
- cb56034: Give `ChipSelect`'s parts and `DropdownMenuRadioItem` a density, so the
  composer's two menus are a shape the components own rather than measurements
  restated at each call site: `ChipSelectPopup`, `ChipSelectItem`,
  `ChipSelectSearch` and `ChipSelectBack` take `density="menu"` for the engine
  pane, and `DropdownMenuRadioItem` takes `density="compact"` for the permission
  menu. New `ChipSelectList` is one pane body — rows, the loading line, or the
  empty one — and caps itself in rows of its density; `ChipSelectEmpty` takes
  `live` for a list still being read, and `ChipSelectItem` takes `trailing` for a
  row that ends in something other than a check. `ChipSelect` and
  `RepositorySelect` take `loading`, and `RepositorySelect` a separate
  `branchesLoading` for its branch pane.

### Patch Changes

- 287d688: Composer: give the prompt box back the height the design gives it.

  `field-sizing-content` sizes a textarea to its content and overrides the `rows`
  attribute outright, so the empty composer collapsed to a single line while every
  class still looked correct. The export's floor is 112px, which is the prompt box
  having presence before anyone has typed into it — the whole point of the
  control. It is a `min-h` now, with `rows` kept as the no-`field-sizing`
  fallback.

  Measured against `.op-composer__input` in the same pass: the textarea's vertical
  padding is 16px both sides rather than 16/8, the attach and mic buttons are the
  export's 30px tool rather than the 28px `sm` control, and their glyphs and the
  send arrow are 15px at stroke 2.2.

  The type is a new `text-compose` step (16px/1.5). The export declares 16px
  nowhere but this one rule — it sits between body (15px) and body-lg (17px) —
  which is the same case `text-operate` already documents, so it is a named token
  with a comment rather than an arbitrary value or a rounding to the nearest step.

- 5bd4a8b: New session sets how a session is launched, and `POST /sessions` takes it.

  The route grows a `launch` object — model, permission level, effort — and the
  `prompt` typed into the composer. The launch is folded onto `work_session` so a
  restart can relaunch a session the way it was launched without walking its log.
  The prompt is a log entry and rides `session.create` to the host, where it
  becomes the agent's trailing argument rather than something typed at a running
  terminal — so nothing about the composer waits on the relay, and exactly one of
  the two ends ever writes `prompt.first`. It also names the session, through a
  new `openai-compatible` namer provider that covers Groq, Together, vLLM and a
  local Ollama.

  The agent catalog in `@oppenheimer/shared` grows each agent's models and the
  argv its permission levels, effort stops and first task map to, read off
  claude 2.1.278's and codex-cli 0.155.1's own `--help`.

  **Breaking, `@oppenheimer/frontend-consumer`:** `SessionEntity` was modelling one
  repository, one branch and a `running | idle | stopped` state the control plane
  had stopped sending. It carries `checkouts`, the derived `state` group and the
  stored `lifecycle` now, and `create` takes an idempotency key from its caller.

- 1a51afc: Declare `sideEffects` (CSS excepted).
