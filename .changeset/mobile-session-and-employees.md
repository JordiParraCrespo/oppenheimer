---
"@oppenheimer/mobile": minor
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-mobile": minor
"@oppenheimer/web": patch
"@oppenheimer/translations": minor
---

A session opens on the phone, and the Employees tab lists your bots, each opening its chat (`Mobile.dc.html`).

- `@oppenheimer/mobile`:
  - **A session:** its name and state in the navigation bar with a ··· menu (Share link; Delete session behind the system's alert). The system's segmented Terminal / Chat switch over the session's stream. A glass dock with what the agent waits on (answered through the API), the keys a phone keyboard lacks, and a reply line. The terminal is drawn natively from `@xterm/headless`. One not live says what can be done: Retry, Restart, or open its cloud run.
  - **Employees:** search, each group with its bots, a row per bot opening its chat. The chat streams as the console's does; the dock carries the approval (with the decisions the API offers) or question the bot waits on, and the message field.
- `@oppenheimer/frontend-mobile`: `ListGroup`, the grouped card both lists draw. `crypto.randomUUID` and `getRandomValues` come from `expo-crypto` where Hermes has none.
- `@oppenheimer/frontend-consumer`: `botGroupSections` and `approvalDecisionLooks` move here from the console, so both apps group bots and offer approvals the same way. A bot's stream dials through the platform's event source when one is bound.
- `@oppenheimer/design-system-mobile`: the eight bot avatar colours.
- `@oppenheimer/web`: imports those two from the product package; nothing the console shows changes.
- `@oppenheimer/translations`: `sessions.mobile.*` and `bots.mobile.*`.
