---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/mobile": patch
---

The phone follows the workspace's change feed, so the Sessions tab moves when an agent starts waiting on you or a session starts from the computer.

- `@oppenheimer/frontend-core`: `OppenheimerApp.create` takes an `eventSource` factory (`EventSourceFactory`) for a platform without the browser's `EventSource`; unset, nothing changes.
- `@oppenheimer/frontend-consumer`: the workspace stream dials through that factory when one is bound.
- `@oppenheimer/frontend-mobile`: `createEventSourceFactory(headers)`, Server-Sent Events over `react-native-sse` carrying the session cookie; a refusal stays closed, a drop redials.
- `@oppenheimer/mobile`: the workspace gate holds the feed open for every tab.
