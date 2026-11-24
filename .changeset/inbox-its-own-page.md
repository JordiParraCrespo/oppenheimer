---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/shared": patch
---

The Inbox leaves Plan for a page of its own, the rail's first item, and its
reading pane becomes a deck answered by number keys or a swipe
(`product/versions/mvp/29-inbox.md`, "Its own page, and a deck").

- `@oppenheimer/web`: `/inbox` is the Inbox (`/plan/inbox` redirects there);
  the rail leads with it, with a dot and the count of what needs you, and the
  console lands on it; its sidebar is folders by kind and by project. Plan's
  sidebar drops it and Plan opens on its board. On the deck, 1–9 press the
  card's numbered answers, E, S and L put it away, J / K and the arrows go
  through the stack, a touch swipe right is done and left is later, the next
  card takes the place of the one that left, and the toolbar shows the
  visit's progress.
- `@oppenheimer/design-system-web`: `InboxDeck` (the card on its stack, the
  swipe, the answers' number badges), `InboxDeckKeys`, `inboxDeckAnswer`, and
  `InboxToolbar`'s `progress`.
- `@oppenheimer/translations`: `nav.inbox`, `inbox.folders.*`,
  `inbox.deck.*` and `inbox.pane.cleared`; `tasks.nav.inbox` is gone.
- `@oppenheimer/shared`: the bundled guide, after the docs' Inbox, overview,
  FAQ and Plan pages.
