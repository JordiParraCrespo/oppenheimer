---
'@oppenheimer/api': patch
'@oppenheimer/runner': patch
---

Bots and session agents now show a visual on their own when their answer compares figures, follows a trend or shows progress, instead of writing a table of numbers: the tools said "use it only when", and an eval of both (`scripts/evals/agentic-ui/`) found neither ever drew one unasked. The runner's `show_visual` also says what a metric's `delta` and a block's `format` take, which session agents got wrong.
