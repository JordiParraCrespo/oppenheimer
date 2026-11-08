---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

New session's folder picker searches the host by name
(`product/versions/mvp/24-session-places.md` §4).

- `@oppenheimer/shared`: the link gains `fs.find` and `fs.found` and the
  `fs.find` capability; `hostFolderSearchQuerySchema` is the endpoint's query.
- `@oppenheimer/runner`: answers `fs.find` with a walk under home bounded by
  depth (4), directories read (20,000) and time (400 ms), that skips hidden
  directories and dependency trees and does not walk into git repositories.
- `@oppenheimer/api`: `GET /v1/hosts/{id}/folders/search?q=`, refused as a
  listing of home is.
- `@oppenheimer/api-client`: `searchHostFolders`.
- `@oppenheimer/frontend-consumer`: `HostsRepository.searchFolders`,
  `useHostFolderSearch`, `HostFolderSearch`.
- `@oppenheimer/web`: typing narrows the listed folder to names that hold
  what is typed, those that start with it first; `~billing` is read as
  `~/billing`; a bare name is searched for under home after typing pauses,
  and what is found shows under the listing; a search the host could not
  make says why there, except on a runner too old to search.
- `@oppenheimer/translations`: `sessions.new.folder` gains `searchHeading`,
  `searching`, `searchTruncated` and `searchFailed`; `emptyFiltered` says
  "in its name".
