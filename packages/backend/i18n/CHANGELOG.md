# @oppenheimer/backend-i18n

## 0.1.1

### Patch Changes

- 745dcd8: `Translator` builds one `Intl.PluralRules` per locale and reuses it, instead of
  constructing one on every plural lookup. A locale the runtime rejects is
  remembered and falls back to `one`/`other` without throwing again.
