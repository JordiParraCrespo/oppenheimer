---
"@oppenheimer/runner": patch
---

The runner image builds again: it no longer copies `go.work`, which lists Go modules the image does not carry (`e2e/netsim`), and builds with `GOWORK=off` on the module's own `replace` directives.
