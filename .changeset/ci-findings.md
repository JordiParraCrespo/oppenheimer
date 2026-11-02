---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

What a failing check came to is a record. `record_ci_findings` lets a bot file
one finding per failing check on a pull request's head
(`pull_request_ci_finding`): the cause, its relation to the change, a flake
verdict, the action and how sure, with up to five pieces of evidence. A second
look at a check on the same commit replaces the first. It is filed only for a
check failing on the head GitHub shows (`PULLS_003`, `PULLS_004`). A pull
request's checks now name each failing one with its result, log and summary;
`get_pull_request` and the detail response (`checkCounts.failing`,
`ciFindings`) carry them, and the console's Checks rail lists them with their
findings.
