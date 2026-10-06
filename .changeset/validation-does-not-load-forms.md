---
"@oppenheimer/tsconfig": patch
"@oppenheimer/web": patch
---

Separate validation from the form vendor chunk so loading Zod does not eagerly
load React Hook Form and its resolvers on the web application's first load.
