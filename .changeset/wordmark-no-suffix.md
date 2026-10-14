---
"@oppenheimer/web": patch
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
---

The wordmark stands alone: the console's brand row and the auth and public
pages show "Oppenheimer" without the "Console" suffix. `BrandLogo` and
`AuthLayout` lose their `product` prop, and the `common.product` key is gone
from the catalogs.
