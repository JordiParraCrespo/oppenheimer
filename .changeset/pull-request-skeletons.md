---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": patch
---

Pull requests load in their own shape. The queue, analytics, a pull request's Description, Changes and Chat views, the rail's comments and Watched repositories each draw a placeholder in the real containers, with their static labels written and a bar at the height of each line still to come, so the page does not jump when the data lands; the queue header no longer shows zeros before the queue answers. `PullRequestRowSkeleton` is a queue row's placeholder on the row's own grid, and `Skeleton` is now hidden from assistive technology and pulses only when motion is allowed.
