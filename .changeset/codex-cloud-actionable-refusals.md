---
"@oppenheimer/runner": patch
"@oppenheimer/api": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
---

Codex cloud says what it cannot do and what to do instead. The codex CLI still
starts tasks only in Codex Cloud (Legacy) environments, so the environment
picker now says that one made in ChatGPT Settings → Codex Cloud cannot be
started from a host, and that a list read off recent tasks may be missing some.
A start with no environment the CLI can use (`SESS_010`) names the two ways
out, and also covers an account with no legacy environment and a picked
environment that is gone. A host whose codex is not signed in to ChatGPT has
its own refusal, `SESS_020` on a start and `SESSIONS_055` in the picker.
