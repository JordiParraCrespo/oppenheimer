---
"@oppenheimer/runner": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
---

A Codex cloud start whose environment the CLI cannot find is its own refusal,
`SESS_010`, instead of the CLI's bare "not found". codex-cli resolves `--env`
only against the environments `codex cloud` lists; the ones made in ChatGPT
Settings → Codex Cloud are not reachable by it yet. The detail names the labels
tried and the environment labels on the account's recent tasks (a partial list:
the CLI lists environments only in its TUI), and the failed start's pane
explains it in English and Spanish with a link to Codex Cloud settings.
