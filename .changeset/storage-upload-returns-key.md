---
"@oppenheimer/backend-storage": minor
"@oppenheimer/api": patch
---

`StorageService.upload` resolves to the key on every back-end, and
`getSignedUrl` is renamed `getUrl`.

- `LocalStorageService.upload` used to resolve to a public URL while
  `S3StorageService.upload` resolved to the key, so a caller's result depended
  on configuration. Both now resolve to the key; `getUrl(key, expiresIn?)` is
  the one way to a URL (signed on S3, `<publicUrl>/uploads/<key>` locally).
- The avatar adapter persists what `upload` returns instead of working around
  the disagreement.
