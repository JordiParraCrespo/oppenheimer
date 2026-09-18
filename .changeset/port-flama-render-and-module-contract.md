---
"@oppenheimer/web": minor
---

Carry the console's API-key dialog onto the picker the starter split, and give
the search-field policy one implementation.

**The create-key dialog takes the per-row permission picker.** Upstream split
`PermissionPicker` because one flat `Scope[]` for eleven groups made a click
re-render thirty-three toggles, and put the result behind a full-page screen
this console does not mount. The dialog stays and takes the split:
`CreateApiTokenForm` holds a `ScopeSelection` keyed by resource, each row takes
its own field, and `PermissionField` carries the cross-row rule ("a key with no
scopes can call nothing") without subscribing the picker to the value its rows
write.

**Three clocks, three owners.** The permission search used to be live state in
the component that mapped the groups, so a keystroke redrew every visible row.
`PermissionSearch` keeps the half-typed word, `PermissionCatalog` owns the
settled query and the filter, and a granted level reaches neither. Moving the
query out of the form was not enough on its own — with the draft still in the
component doing the filtering, four characters cost 132 toggle renders, which
is what the new burst assertions in `permission-picker-render.spec.tsx`
measure.

Both fields run on the kit's one `useSearchDraft` — see the
`@oppenheimer/frontend-web` entry for why that hook exists.
