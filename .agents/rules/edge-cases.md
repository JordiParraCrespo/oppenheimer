---
paths:
  - "apps/api/**/*"
  - "apps/runner/**/*"
  - "apps/web/**/*"
  - "apps/mobile/**/*"
  - "apps/cli/**/*"
  - "apps/mcp/**/*"
  - "packages/shared/**/*"
  - "packages/backend/**/*"
  - "packages/frontend/**/*"
  - "packages/go/**/*"
---

# Edge Cases

Most bugs are not in the main path. They come from an input nobody tried, a
limit somebody else owns, or a name used as an identity. Prove each rule
below with a unit test at the owner boundary that feeds the breaking input;
a review that says "covers X" points at that test.

## Text is code points, and storage has rules

- **Cut on code points, never on UTF-16 units.** `text.slice(0, n)` can split
  an emoji's surrogate pair, and Postgres `jsonb` and `text` refuse a lone
  surrogate. Use `Array.from(text).slice(0, n).join('')`, or
  `Intl.Segmenter` when a grapheme must survive whole. A cut that has to fit
  a budget leaves no fragment of a marker or reminder behind, and does not
  drop the text after it.
- **Text bound for Postgres goes through the module's storable-text
  normaliser**, which strips NUL (`\u0000`), on every path that writes it:
  transcripts, tool output, webhook bodies.
- **Offsets survive case folding only when the folding keeps the length.**
  `'İ'.toLowerCase()` is two code units, so a range built on the folded
  string lands past the end of the original. Fold one character at a
  time and keep a map back to the original index, or compare with
  `localeCompare`/`Intl.Collator` instead.
- **A transform over Markdown or markup leaves code alone.** Split out
  fenced blocks and inline code first, transform the rest, and put them back
  (`2 ** 3` became `2 * 3` in Slack).
- **Expanding a label inside text rewrites only the text the person typed**,
  never the inside of an earlier paste or attachment.
- **Line-oriented formats keep their last empty line.** `split('\n')` on a
  patch or a log that ends in a newline gives a final empty element; dropping
  it changes counts and content.

## Keyboard input

- **Enter and the arrow keys do nothing while an IME is composing.** Check
  `event.nativeEvent.isComposing` (or `keyCode === 229`) before picking an
  option or sending. Japanese, Chinese and Korean input confirm
  with Enter.
- **Escape belongs to the surface that has focus.** A global Escape handler
  that cancels a turn also fires when a search field or a menu inside the
  page is closing.

## Limits you do not own

Every limit between your code and the reader is part of your code. Look each
one up before writing the path that can reach it:

- the deployment's proxy body size (four pictures passed the API's
  limit and hit the proxy's 8 MB);
- the API's own page and batch caps, which a client must chunk to (more
  than 200 lines per batch stalled streaming; past 100 open reports, the
  older ones became unreachable);
- a vendor's message, file or rate limits (`integrations.md`).

A size cap on a stream is enforced while reading it, not after buffering it
all. A walk over pages keeps what it has read when a later page fails,
and says it stopped short.

## Identity is an id

- **Match on an id, never on a name, a branch name, a label or the content.**
  A fork can reuse a branch name, a group can be renamed, two
  people can send the same message. Store the id at the moment the
  person chose, and compare ids.
- **Name the id you mean.** When an event carries several ids (a task, the
  watch that followed it, the session), the wake, the log and the reply name
  the one the reader acts on.
- **Resuming a conversation targets its id.** A `--continue` that picks "the
  latest" in a shared directory can open another session's conversation; pass the session's own id or refuse.

## Heuristics fail safe, and are tested where they break

A proxy signal used to reject or classify input (a packet size, a length, a
regex, a denylist) is tested against the inputs that defeat the proxy, not
only the ones that motivated it. Audible Opus can come in eight-byte packets; `git -C dir push --force` hides the subcommand from a naive parser. Write down which way it fails, and make that the safe way: refusing a
voice note is recoverable, running a destructive command is not.

## Time and schedules

- **A schedule's next run is searched over a full cycle.** Cron with a
  day-of-month and a weekday can skip decades; search one Gregorian cycle
  (400 years) or prove it never fires.
- **What a schedule is said to do is computed by what runs it.** `*/25`
  fires at :00, :25 and :50, so "every 25 minutes" is wrong. Describe
  it from the same evaluator, or test the description against it.
- **Live state is never removed by age alone.** A sweep that deletes "stale"
  stages by wall-clock time removes the one in use on a slow or sleeping
  host; check that nothing points at it.
- **Every timer and listener a hook or service starts is cleared when it is
  disposed**, and a check-in that must outlive a step is armed for the
  whole lifetime it watches.

## Removing, renaming and migrating

- **Before removing or renaming anything, search every consumer**, not only
  the package that owns it: the e2e specs, the eval fixtures and scripts
  under `scripts/evals/`, seeds, the docs, and the showcase (five eval
  fixtures imported a deleted component; a live e2e spec still found
  the composer by its old placeholder).
- **Rows already stored keep working.** Removing a catalog entry that saved
  records point at drops what they carried; a new column that a guard
  reads is backfilled or the guard handles `null`.
- **What mounts once at the root is checked at the root.** A provider, a
  portal host, a stream subscription: a new screen that needs one confirms
  the app's root mounts it (no portal host, so every dialog opened
  empty).

## Copy promises only what the code does

A guide page, an empty state, a bot's greeting or its system prompt describes
only actions the routes and tools can perform today (the Guide
promised "Bring back" for done tasks; a read-only bot offered to make
changes). A prompt template refuses to send an unfilled slot instead of
falling back to the placeholder.
