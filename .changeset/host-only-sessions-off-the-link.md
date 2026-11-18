---
'@oppenheimer/runner': patch
'@oppenheimer/api': patch
---

A host with child sessions stays online. The runner no longer puts sessions
it created for itself (`runner sessions run`, `runner sessions create`) on the
link. Their 12-character ids are not UUIDs, so the control plane refused any
hello that listed one, and the host stayed offline after every reconnect.
Their events stay off the link too. Before, the control plane dropped those
events without acking them, and the runner resent them every minute.

The control plane now logs which fields of a refused hello or control frame
failed, and why, instead of only how many.
