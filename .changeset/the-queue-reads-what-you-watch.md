---
"@oppenheimer/api": patch
---

The PR queue reads the repositories you watch, and no others. Reading every
repository an installation reaches so that Mine and Review requests could come
from anywhere cost a request per pull request per repository on every page
view, which GitHub answers with a secondary rate limit.
