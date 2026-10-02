# @oppenheimer/go-httpx

## 0.1.1

### Patch Changes

- ab7c65d: `TestServeAcceptsAProvidedListener` builds its socket in a short temp directory.

  `t.TempDir()` names the directory after the test, and a Unix socket path is
  capped at 104 bytes on macOS (108 on Linux). This test's path came to 108, so
  `net.Listen` failed with a bare `bind: invalid argument` on macOS while CI, on
  a shorter TMPDIR, stayed green.
