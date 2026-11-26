---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/shared": patch
---

The Inbox leaves Plan for a page of its own, the rail's first item, and its
reading pane becomes a deck answered by number keys or a swipe
(`product/design/console/29-inbox.md`, "Its own page, and a deck").

- `@oppenheimer/web`: `/inbox` is the Inbox (`/plan/inbox` redirects there);
  the rail leads with it, with a dot and the count of what needs you, and the
  console lands on it; it has no sidebar (`sidebar: 'none'`). Plan's
  sidebar drops it and Plan opens on its board. On the deck a card shows
  only its answers, numbered for 1–9, and a dock under it has Previous, Done
  and Next (K, E, J, a swipe left and right); a card that waits on an answer
  has no Done; a questionnaire goes one question at a time; the next card
  takes the place of the one that left, and the bar over it shows the
  visit's progress. Mark as done takes up a task an agent made.
- `@oppenheimer/design-system-web`: `InboxDeck` (the card on its stack, the
  swipe, the answers' numbers), `InboxDock`, `InboxQuestionSteps`,
  `InboxAnswerSummary`, `inboxDeckAnswer`, and `InboxToolbar`'s `progress`.
  `InboxMessageActions` takes only the answers, as rows (no `leading`), and
  `InboxQuestionOption` is a row.
- `@oppenheimer/frontend-web`: a route's `sidebar: 'none'` leaves the shell's
  sidebar out.
- `@oppenheimer/translations`: `nav.inbox`, `inbox.dock.*`, `inbox.question.*`,
  and `inbox.pane.cleared`; `tasks.nav.inbox` and the cards' Later, Done and
  Dismiss labels are gone.
- `@oppenheimer/shared`: the bundled guide, after the docs' Inbox, overview,
  FAQ and Plan pages.
