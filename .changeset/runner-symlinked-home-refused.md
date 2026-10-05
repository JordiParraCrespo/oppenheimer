---
"@oppenheimer/runner": patch
---

**Upgrade note:** a runner home that is a symlink is now refused. `runner run`
stops with `HOST_008` ("The runner's own directory is not safe to use") when
`~/.oppenheimer` (or `RUNNER_HOME`), or the `run/` directory under it, is a
symlink, where earlier versions followed it. A host whose home was moved to
another disk and linked back stops coming online after this update, and its
service keeps restarting into the refusal. Put the real directory back in
place (`target="$(readlink -f ~/.oppenheimer)" && rm ~/.oppenheimer && mv
"$target" ~/.oppenheimer`) or install again with `RUNNER_HOME` set to the real
path, then restart the service. The error reference's runner section
(`apps/docs/docs/errors.md#host_008`) has the steps.
