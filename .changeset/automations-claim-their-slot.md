---
"@oppenheimer/api": patch
---

An automation run reserves its slot, so the overlap and capacity guards
actually cap.

`liveRunsPerHost` and the overlap policy were weighed against counts read a
moment before the run launched, and the runs processor dispatches four at once:
every worker read the same counts, every worker passed. Measured on a real
stack — ten manual runs of an automation whose overlap is `skip`, which means
one live run — **four** sessions started, one per worker. The same burst now
starts one.

The reservation is a new `automation_run."claimedAt"`, written under a per-host
advisory lock against counts read inside it, and counted by both guards while
it is fresh. It is deliberately not another `outcome`: the run stays `pending`
while it holds a slot, so the state machine every client reads is unchanged and
"dispatched implies a session" keeps holding — a first version of this fix
marked the run dispatched early and broke exactly that, which the API's own e2e
caught. A claim is honoured only while fresh, so a process dying between the
claim and the session frees the slot with nothing to clean up.
