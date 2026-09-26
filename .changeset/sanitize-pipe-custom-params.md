---
"@oppenheimer/backend-core": patch
---

`SanitizePipe` no longer rewrites custom route parameters. It rebuilds objects
to strip HTML, which is right for a JSON body and destructive for anything a
`createParamDecorator` read off the request: a `Map` came back as `{}` and a
class instance lost its prototype, so a resolved access scope reached a
repository with no `grants.get`. Bodies, query strings and route parameters are
sanitized exactly as before.
