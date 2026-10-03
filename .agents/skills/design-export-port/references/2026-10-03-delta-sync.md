# 2026-10-03: a delta sync (host offline, file drop)

Do not replay these. They record what one small export needed that the
workflow did not predict.

- The export (JordiParraCrespo/oppenheimer#226) changed two artboards. Every
  new state sat behind a page prop (`hostLink`, `offlineStyle`,
  `firstClone`) or a drag, none behind a click, so the renderer grew
  `--props`, `--drag` and `--tag`.
- The renderer's CDN interception never worked: `page.route('https://**')`
  matched none of the script requests, so every capture fetched unpkg live
  and failed whenever the proxy did (`ERR_TOO_MANY_RETRIES`, "failed to load
  react-dom"). The earlier note blamed `crossorigin` and SRI. The fix was a
  URL predicate, plus `access-control-allow-origin` on the stand-in
  response, which those `crossorigin` scripts then need.
- Scope was the package and the showcase only, by the user's word: the
  frames' upload of non-image files into a running session, the console's
  wiring and the notes in `product/` stayed out. `RoutineRun*`, which the
  frames dropped, stayed because the console still imports it.
- Names that collided: `CommandList` is cmdk's, so the stack of command rows
  is `CommandRowList`. The type checker caught it through the barrel.
- The review page the user asked for by name was the 2026-09-28 "console vs
  frames" artifact, whose script was never saved; `build-compare.mjs` is it,
  for frames beside showcase states.
