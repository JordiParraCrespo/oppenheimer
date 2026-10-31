---
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": major
"@oppenheimer/web": patch
---

Less boilerplate in the product package, the same behaviour.

- Repository methods are `callApi(X, async (api) => …)`, naming their failure once; `@MapApiError` is gone and `unwrap` is no longer exported (`unwrapBody` stays).
- Mutation hooks come from `defineMutation(useApp)({ run, invalidates | update })`; the consumer binds it as `mutation`.
- `SessionEntity`, `PullRequestEntity` and `AutomationRunEntity` take one props object (`XProps`), set with core's `assignProps`, which keeps a field's default where a prop is undefined. `@oppenheimer/frontend-consumer/testing` builds the three for tests.
- `ServerEventStream<TEvent>` in core is the Server-Sent Events stream `BotStream` and `WorkspaceEventStream` extend; the attach streams share their socket setup, and the device stream redials on the configured reconnect ladder.
