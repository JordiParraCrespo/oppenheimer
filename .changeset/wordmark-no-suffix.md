---
"@oppenheimer/web": patch
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/web-showcase": patch
---

The wordmark stands alone: the console's brand row and the auth and public
pages show "Oppenheimer" without the "Console" suffix. `Wordmark` loses its
`product` prop, `BrandLogo` is gone (the auth and public chrome draw
`Wordmark` directly), `AuthLayout` loses its `product` prop, and the
`common.product` key is gone from the catalogs.
