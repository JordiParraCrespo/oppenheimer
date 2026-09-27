---
"@oppenheimer/runner": minor
---

Sessions start faster: a repository's store is a blobless clone with nothing checked out, and each session fetches only the branch it is made from, with no tags and git's automatic gc off.
