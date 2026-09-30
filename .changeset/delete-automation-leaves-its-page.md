---
"@oppenheimer/web": patch
---

Deleting an automation from its own page goes back to the list, with the toast
that says it was deleted, instead of leaving the browser on the page of an
automation that no longer exists.

The delete's cache update refetched that page into a 404, which unmounted the
header that had asked for the delete, and the toast and the navigation were
callbacks on its `mutate` call, which do not fire once the caller is gone. They
now hang on the mutation itself.
