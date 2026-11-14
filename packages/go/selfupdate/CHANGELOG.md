# @oppenheimer/go-selfupdate

## 0.2.0

### Minor Changes

- 48e1255: On macOS the runner ships as `OppenheimerRunner.app`, signed with a Developer
  ID and notarized, and runs from one fixed path, `~/.oppenheimer/bin/OppenheimerRunner.app`,
  which an update swaps in place. macOS keeps the runner's permissions
  (Documents, Desktop, network volumes, Full Disk Access, the local network)
  for the signed bundle, so a Mac no longer asks for them again after every
  update. A Mac a runner from before the bundle updated reinstalls its own
  version as the bundle at its next quiet moment. `selfupdate.UnpackTree`
  extracts a directory, such as the bundle, from a release archive.
