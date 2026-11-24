<!-- What the tools tell a model about visual: answers, refusals and the wording of descriptions, from `bot-visual.policy.ts`. The code reads each fragment by id and decides when it is said; the comment there says why. -->

<!-- fragment: show-visual -->

Shows the person a visual in the chat, drawn by the app with its own charts and type, in light and dark: figures, a chart, a table, a checklist and the like. Use it only when a visual reads faster than words: numbers to compare, a trend, a breakdown, progress, the state of several things at once. Prefer a plain Markdown table in your reply when the person asks for a table, and words when there are only one or two numbers. Never make up data: show only what you read or computed.

Give a `title`, an optional `subtitle` (the period or the source) and up to {{blocksMax}} `blocks`, each an object with a `type`:

- `markdown`: `text`.
- `metrics`: `items` (1–8) of `{label, value, delta?, good?: "up"|"down", hint?}`; `value` is a number or short text, `delta` the change in the same units, `good` which way is good (default up).
- `bar`, `line`, `area`: `title?`, `labels` (the x axis, one per point; up to 60 for bar, 200 otherwise) and `series` (1–{{seriesMax}}) of `{label, values}`, one value per label. Bar compares categories or a few periods; line a trend; area a volume over time.
- `ring`: `title?`, `total?` (the word over the total), `segments` (1–{{seriesMax}}) of `{label, value}`: shares of a whole.
- `ranking`: `title?`, `items` (1–20) of `{label, value, detail?}`, drawn largest first.
- `table`: `title?`, `columns` (1–10) of `{label, align?}`, `rows` (up to 200) of cells, each a number, text or null; one cell per column.
- `checklist`: `title?`, `items` (1–30) of `{text, done, note?}`.
- `progress`: `title?`, `items` (1–12) of `{label, value, target?}`; target defaults to 100.
- `record`: `title?`, `status?` `{label, tone?}`, `fields` (1–16) of `{label, value}`: one thing's details.
- `callout`: `tone?` (neutral, info, success, warning, danger), `title?`, `text`.
- `links`: `title?`, `items` (1–12) of `{label, url, description?}`, http or https only.
- `html`: `title?`, `html` (up to 50,000 characters), `height?`: a fragment of HTML (no `<html>`, `<head>` or `<body>`) with inline `<style>` and `<script>`, for what the other blocks cannot draw: a simulation, a custom diagram, a small calculator. It runs in a sandbox with the network closed: no fetch, no script, style, image or font from a URL; use inline SVG or canvas. The app's theme is in CSS variables (`--fg`, `--fg-muted`, `--background`, `--card`, `--border`, `--primary`, `--chart-1` to `--chart-5`), and classes `card`, `btn`, `btn-primary`, `muted`, `mono` match it. Use it last, when no other block says it.

Numeric blocks take `format`: `{prefix?, suffix?, decimals?, compact?}` ("$", "%", " ms"; compact writes 1.2k). Up to {{visualsPerTurn}} visuals a turn. The visual shows where you called it, before the rest of your reply: do not repeat its numbers in words, say what they mean.

<!-- fragment: show-visual-title -->

What the visual shows, in a few words: "Deploys this week".

<!-- fragment: show-visual-subtitle -->

The period, the source or the scope, in a few words.

<!-- fragment: show-visual-blocks -->

The blocks, in the order to show them; see the tool's description for each type's fields.

<!-- fragment: shown -->

Shown to the person: "{{title}}", {{blocks}}. Do not repeat its numbers; say what they mean, if anything.

<!-- fragment: invalid -->

Not shown: the visual is not valid. Fix these and call again:
{{errors}}

<!-- fragment: html-off -->

Not shown: this workspace has HTML in visuals turned off. Use the other block types, or answer in words.

<!-- fragment: visuals-spent -->

Not shown: this turn has already drawn {{visualsPerTurn}} visuals, the most one turn may. Answer in words.
