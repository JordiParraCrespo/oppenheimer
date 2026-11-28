---
'@oppenheimer/api': minor
'@oppenheimer/shared': minor
---

A GitHub event starts an automation or routine run, and wakes a bot or a
session following a pull request, only when an insider of the repository
caused it: its owner, a member of its organization or a collaborator, by
GitHub's `author_association`. A stranger's issue, comment, review, mention or
pull request on a public repository starts nothing and records no skipped run.
A label counts when someone other than the item's author added it, a check
only on a branch of the repository (never a fork's commit), and a push, merge
or release always. An event that carries no association fails closed.

A routine webhook URL issued through the API without `signed` is now signed
when the deployment can keep a secret (`BOTS_PROVIDER_KEY`); URLs already
issued keep what they had. A signed request posted a second time inside its
five-minute window is refused with `AUTOMATIONS_011`, whatever
`Idempotency-Key` it carries.
