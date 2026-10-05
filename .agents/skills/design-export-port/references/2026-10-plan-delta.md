# 2026-10-05 delta: Plan (not to be replayed)

What the Plan export (`Tasks.dc.html`) needed that the workflow did not
predict. A record of one run, not steps.

- **Behaviour the frames hand-write twice is one primitive.** The board
  dragged cards with pointer events, a placeholder and a FLIP slide; the
  month used the browser's native drag with no preview. Both became one
  headless layer (`drag.tsx`) over dnd-kit, with the board's motion as the
  layer's default, so every later surface (sidebar rows onto projects,
  reordered steps) gets it for free. The person asked for generic
  primitives explicitly; read the frame's script for its numbers (5px start,
  220ms slide, 200ms glide, the 1.6° lift) and port those, not its code.
- **Most of a new page's states hide behind clicks, not props.** Tasks had
  three props; the dialogs, the date picker, the link-session list and the
  composer were reached with `--click` chains (`[data-card] >> nth=4`, then
  a button by text).
- **`--click` needs Playwright's own browser path here**: with no bundled
  headless shell, set `PLAYWRIGHT_CHROMIUM=/opt/pw-browsers/chromium`. A run
  that dies before capture leaves its `http.server` on 8765; kill it before
  the next run, or every later run times out on the port.
- **Verify a drag with a real pointer, mid-drag.** A browser script that
  presses, moves in steps, screenshots before releasing and reads the
  columns after caught an over-eager edge auto-scroll that ran the page away
  from the target; the layer's auto-scroll band is 8% for that reason. Keep
  the pointer clear of the viewport's edges in such a script, and scroll the
  showcase's inner column, not the window.
