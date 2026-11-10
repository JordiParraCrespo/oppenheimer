---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": patch
"@oppenheimer/translations": minor
---

Inbox reports, the console (`product/versions/mvp/29-inbox.md`, "Reports"). A
problem an unattended agent sent is one more Inbox item, `report`, read with
its pictures and answered on its card.

- `@oppenheimer/frontend-consumer`: `InboxReportEntity`, and on the inbox
  repository `findReports`, `readReportImage` and `answerReport`
  (`INBOX_CLIENT_004`–`006`). The open reports are the Inbox's ninth read
  (`inboxKeys.reports()`), composed as `kind: 'report'` under
  `report:<id>` with no project and every mark. `useInboxReportImages` reads
  a report's pictures as blobs; `useAnswerInboxReport` replaces the row with
  the answered report, so it leaves the list at once, and reads the reports
  again on a refusal. `inboxReport.changed` refetches the reports.
- `@oppenheimer/web`: `InboxReportCard` in the reading pane: the sender, the
  title, the body as plain text with its line breaks, the link, the pictures
  as tiles that open whole, an answer field with Send answer, Later and
  Done. The list row, the search and a Reports option in the Type filter.
- `@oppenheimer/frontend-web`: `useObjectUrls` moves here from the bots
  feature, now that the Inbox draws fetched pictures too.
- `@oppenheimer/translations`: `inbox.report.*`, `inbox.type.report` and
  `inbox.from.report`.
