---
"@oppenheimer/backend-i18n": patch
---

`Translator` builds one `Intl.PluralRules` per locale and reuses it, instead of
constructing one on every plural lookup. A locale the runtime rejects is
remembered and falls back to `one`/`other` without throwing again.
