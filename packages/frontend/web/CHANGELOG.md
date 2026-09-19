# @oppenheimer/frontend-web

## 0.2.0

### Minor Changes

- f099524: Ship the PostHog web analytics adapter, driven by `VITE_POSTHOG_KEY`.
- 1ad71b4: Split `DataTable` so the search field, the selection and the rows stop sharing a clock: a keystroke now re-renders zero rows. `useTableQuery` keeps one `search` — the settled value — and no longer debounces its URL write.
- f099524: Ship `useZodResolver`, which wires `createZodErrorMap` into React Hook Form.

### Patch Changes

- f099524: Follow the `@oppenheimer/config` → `@oppenheimer/tsconfig` rename.
- Updated dependencies [1a51afc]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [1a51afc]
- Updated dependencies [1a51afc]
  - @oppenheimer/design-system-web@0.2.0
  - @oppenheimer/frontend-core@0.3.0
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/translations@0.3.0
