---
"@oppenheimer/runner": patch
---

`runner run` makes its home and `run/` directories private before it opens the
control socket: a directory left looser than `0700` (created by hand, by an
older version, or restored from a backup) is tightened, and a symlinked one, or
one another account owns, is refused with `HOST_008`. That closes the window
between the socket's `Listen` and its `Chmod 0600`, in which the socket that
hands out installation tokens had the process umask's permissions.
