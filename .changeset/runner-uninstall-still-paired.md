---
"@oppenheimer/runner": patch
---

`runner uninstall` no longer reports success when the control plane did not unpair the host: it still erases the identity, but prints the underlying failure (request, status, the control plane's reason) and how to finish — Remove under Settings → Hosts, or `DELETE /api/v1/hosts/{id}` with an API token — and exits 7 with `PAIR_009`. A refused revocation is `PAIR_008` rather than a registration-token error. `register` on a host that is already paired names both control planes and the `uninstall` / `register --force` commands that move it.
