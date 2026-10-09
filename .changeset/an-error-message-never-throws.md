---
"@oppenheimer/frontend-core": patch
---

`useErrorMessage` no longer throws when react-i18next has no i18next instance to hand back: an API error code resolves to the generic message instead of taking the whole screen down through the error boundary, and dev builds log once naming the likely cause (no `initReactI18next`, or two installed copies of react-i18next/i18next).
