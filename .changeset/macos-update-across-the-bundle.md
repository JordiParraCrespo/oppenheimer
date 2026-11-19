---
"@oppenheimer/runner": patch
---

Macs on runner 0.1.12 or older can update again. They take the first file
named `runner` out of a release archive and run it outside any bundle, and
since 0.1.13 that was the app bundle's executable, which macOS kills once it
is out of the bundle it is signed with. A macOS archive now carries the same
binary signed on its own first (`release.sh`, which checks every archive it
writes for it); the version an old runner installs from it reinstalls itself
as the bundle.

A stage that fails its self-check, or cannot be promoted, is deleted instead
of left in `~/.oppenheimer/bin/.staging`, and each boot deletes what has sat
there for over an hour.
