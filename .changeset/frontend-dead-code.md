---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/web": patch
---

Unused code is removed and barrels export only what the console imports. Core drops `useUpdateUser`, `useDeleteUser`, `useUpdateUserSettings`, `useChangePassword`, `MEMBER_LISTS_KEY` and the password-rule helpers; consumer drops the API-token list/create/revoke hooks, `useStopSession`, `useRemoveInstallation`, `useRepositoryBranches`, `useCreateOrganization`, `useUpdateOrganization` and `useAutomationRun`; the kit drops `PageHead`, `FieldRow`, the `roles` concern, `useAbility`, `useLandingRoute` and its own `BrandGlyph`.
