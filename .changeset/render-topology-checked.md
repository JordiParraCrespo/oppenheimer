---
"@oppenheimer/frontend-web": minor
---

Stop paying for render coupling the React Compiler was hiding.

`DataTable` was one 624-line component holding the search field, the selection,
every row and the pager — three things on three different clocks, so each one's
update redrew the other two. Measured, a keystroke re-rendered all eight rows of
the roles table, for a query that was debounced anyway and had not been asked
yet. It is now a shell over a header, a body, a row, a footer and a search field
that keeps the half-typed word itself and commits once per burst: zero rows per
keystroke.

`useTableQuery` loses its own debounce, an effect, and the `searchQuery` alias
with it. One `search`: the settled value, which seeds the field and which a
request reads. The URL write is no longer debounced either — a second delay on
the way out lands after the reader has typed on, and the field would take its
own late echo as news and snap the caret string back.

`*-render.spec.tsx` files run in a second vitest project with the compiler
switched off, where this kind of regression is visible at all; the two projects
are shared from `@oppenheimer/tsconfig/vitest-frontend.mjs` so a package cannot set up
half of them. `pnpm check:structure` gained one check — a query subscribed to
only so a single sibling can render it.

**And one search field, not two.** The draft, the debounce and the
ignore-your-own-echo rule move out of `DataTableSearch` into `useSearchDraft` in
the `forms` concern, with `useDebouncedCallback` beside it (it was in `table/`,
and neither is table-specific). `DataTableSearch` is now the table's markup and
sizing over that hook. `value` is for a field whose settled value lives outside
it — the URL, here; a field with nothing feeding one back down omits it and has
no echo to ignore. This exists because the next search field written without it
came with its own debounce constant and no echo rule, which is how the last
stray debounce survived a refactor.

