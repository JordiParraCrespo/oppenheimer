---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
---

Every bot knows Oppenheimer from its own guide, the way Claude Code reads its own docs.

- The docs site has a user guide, "Using Oppenheimer": eleven pages on hosts, sessions, projects and tasks, bots, routines and watches, automations, the inbox, GitHub, the CLI and MCP, and a FAQ.
- `pnpm generate:guide` bundles those pages into `@oppenheimer/shared/guide`, so the API ships the guide of its own version; `check:guide` fails when the two differ.
- Every bot has a built-in `oppenheimer` skill and the `read_oppenheimer_docs` tool: before it answers a question about Oppenheimer or what it can do, it reads the index and the pages it needs, answers from them, and says so when the guide does not cover it. The name `oppenheimer` is reserved for skills.
- With `DOCS_URL` set, a page the bot read carries its address on the docs site, and the bot links it.
- The docs build writes `/llms.txt` and each page as `/guide/<id>.md`, for agents outside Oppenheimer.
- A skill name reserved after a skill was saved under it no longer stops that skill from loading.
