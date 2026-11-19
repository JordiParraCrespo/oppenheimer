<!-- What the tools tell a model about guide: answers, refusals and the wording of descriptions, from `bot-guide.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: index -->

Oppenheimer's guide, {{guidePagesCount}} pages.{{site}} Read a page with `read_oppenheimer_docs` and its id.

{{lines}}

<!-- fragment: read-oppenheimer-docs -->

Reads Oppenheimer's own guide: what Oppenheimer is, how its hosts, sessions, projects, bots, routines, automations, inbox, GitHub, CLI and MCP work, where things are in the console and how to set them up. Use it before answering any question about Oppenheimer itself or about what bots can do in it, and answer from what it says. With no page it lists the pages and what each covers; with a page id it returns that page.

<!-- fragment: read-oppenheimer-docs-page -->

The page to read, by its id from the index (e.g. "sessions"); a `./sessions.md` link works too. Leave it out for the index.
