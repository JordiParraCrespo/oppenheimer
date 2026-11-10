---
'@oppenheimer/web': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/translations': minor
---

Start session from a task no longer needs a repository: the Repository chip offers No repository (the default for a project with none), which on a host opens the session in the host's home folder, as Open terminal does. A cloud place still starts from a repository and says so, and an offline host holds a session with no repository, since only the host can say where its home is.
