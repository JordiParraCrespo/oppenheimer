---
"@oppenheimer/shared": patch
---

The ESM build now loads in plain Node. Every relative import in `src/` is fully
specified (`'./link.js'`, `'./constants/index.js'`), so `import('@oppenheimer/shared')`
and its subpaths no longer fail with `ERR_UNSUPPORTED_DIR_IMPORT` outside a
bundler, and the build's last step imports every ESM entry in Node to keep it
that way.
