---
"@oppenheimer/shared": minor
"@oppenheimer/web": patch
---

`@oppenheimer/shared` ships an ESM build in `dist/esm/` for the `import`
condition beside the CommonJS one, declares its side effects (the two protocol
modules that register JSON-Schema ids), and collapses its export map to four
patterns that keep every existing specifier resolving. The web bundle now
tree-shakes it: the first load drops from 429.3 KB to 376.2 KB gzipped, and
`apps/web` no longer carries the `optimizeDeps.include` list or the
`commonjsOptions` override that the CommonJS-only build needed.
