---
paths:
  - "apps/web/**/*"
  - "apps/mobile/**/*"
  - "apps/extension/**/*"
  - "packages/frontend/**/*"
---

# Client State: Failures, Races and Live Data

The bugs that hide in a client: a failure drawn as an empty screen, a draft
lost to a failed send, a late response putting old data back, a list that
never hears about a change. The read side of failures is `frontend-ui.md`'s
`QueryState` row; this file is the rest. Prove each rule with a test that
makes the request fail, arrive late or arrive from elsewhere.

## A failure never looks like an answer

- **A read that fails is never drawn as empty, "not found" or a blank
  calendar.** It shows the failure with Try again. In
  `apps/web` that is `QueryState`; the phone app draws the same three states
  (pending, error with retry, data) through its kit's `RecordState`, and a
  screen with a `status === 'error'` it never draws is the bug.
- **A write that fails keeps what the person typed.** A composer clears its
  draft optimistically only if `onError` puts it back, unless the person has
  typed something new since. The error shows beside the composer with
  a way to send again.
- **A send while the connection is down is refused visibly, never dropped.**
  The control knows the connection state and disables or queues, saying
  which.
- **A partial failure is reported, not swallowed.** A reply made of several
  sends keeps the one that failed in what the person sees; a routed
  update that failed halfway refreshes what it touched.
- **A background write the person never sees (mark read, acknowledge) is
  retried on the next chance**, not given up after one failure. A
  retry after a lost response checks whether the first attempt landed before
  failing on a precondition that attempt changed.

## A late answer never wins

- **A mutation cancels the reads it is about to replace.** In `onMutate`,
  `queryClient.cancelQueries` on the keys it writes, so a read already in
  flight cannot land after the mutation and put the old value back.
- **A save applies only if it is still the latest.** Two saves of the same
  thing (a drag, then another drag) can answer out of order; keep a sequence
  or compare with the snapshot the save started from, and drop the stale
  answer. An edit dialog compares the person's edits with the
  snapshot it opened on, not with what has loaded since.
- **A refetch never changes what the person is acting on.** The target of a
  pending approve, merge or delete is held by id from the moment it was
  shown, not re-read from the list position.
- **An optimistic id swapped for the stored one keeps the item's UI state**
  (animation, selection, focus): key it by a client id that survives the swap.

## Data other people change arrives without a reload

- **A list another device or the agent can change subscribes to the
  workspace event feed**, and says which event refreshes it. A screen that
  reads once and never subscribes is stale for as long as it is open. In the phone app the feed is mounted once at the workspace gate.
- **State kept per device in `localStorage` listens to the `storage` event**,
  so every open tab agrees.
- **An indicator built from the stream says when the stream is down.** An
  attention dot that reads a cache the stream feeds goes stale silently when
  the stream drops; refetch on reconnect, or mark it unknown.
- **Every viewer of a shared object hears its change.** When one viewer
  switches a session's device, the others are told too.

## Selection and visibility agree

- **Rows hidden by a filter or a search leave the selection**, or come back
  unselected.
- **A marquee or a select-all takes only what the person can see**, inside
  the scroll container's visible box.
- **A filter's "show done" list includes what the person just marked done**.

## Layout holds at every width, and every control has focus

- **Check each screen at 390, 500 and 900 pixels wide** as well as the
  desktop width (`pnpm screens --widths 1440,900,500,390`): long text truncates or wraps instead of overlapping the
  next column, and nothing sits behind the mobile bottom rail.
- **A component that removes the outline draws its own `focus-visible`
  ring**, and so does every button built on it.
- **A press inside a draggable row does not start the drag** when it lands
  on a control of its own.
- **A list of options exposes the active one to screen readers**
  (`aria-activedescendant` on the input that owns the list).
