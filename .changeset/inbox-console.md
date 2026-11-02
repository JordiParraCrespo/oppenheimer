---
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
---

The Inbox in the console (`product/versions/mvp/29-inbox.md`): a first rail item with a bell and the count of what needs you, where the console now lands (a stored rail order that lacks it gets it at the front). `/inbox` lists sessions waiting on you, bots' pending approvals, pull requests requested of you or ready to merge, and the last day's failed runs, most blocked first, filtered by type and project, with Show done and a Snoozed list; each row's menu marks it done, deprioritizes it, snoozes it or deletes it. The pane brings one item at a time as a card with its answers (Approve / Deny, Merge and Review, Run again and Open run, Open session), Later, and a log of what was done this visit. Behind the `inbox` flag.

`@oppenheimer/frontend-consumer` adds the `inbox` module (marks, and the composition of the four reads into ordered, keyed items), `useSuspenseInbox`, `useInboxCount`, `usePutInboxMark` and `useDeleteInboxMark`, and declares itself free of side effects so the console's bundle carries only the hooks it uses. `@oppenheimer/design-system-web` adds the Inbox's parts (`InboxItem`, `InboxCard`, `InboxLogLine`, `InboxSnoozedRow`, …).
