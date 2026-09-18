---
"@oppenheimer/tsconfig": minor
---

Add `@oppenheimer/tsconfig/vite-chunks.mjs`, the shared per-library vendor
chunking both web apps build with, so a release invalidates app code and leaves
the vendor chunks cached. The ~48KB gzipped cold-load cost of splitting is
recorded in that file.
