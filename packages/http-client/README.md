# @oppenheimer/http-client

The HTTP transport `opp` (`apps/cli`) and the MCP server (`apps/mcp`) call the
API through. One copy of what a request carries and what a failed answer says,
so the two clients cannot drift when the API adds a header or an error shape.

```ts
import { HttpClient, HttpTransportError, readProblem } from '@oppenheimer/http-client';

const http = new HttpClient({ apiUrl: 'http://localhost:3001', token });
const response = await http.request({ method: 'GET', path: '/hosts', query: { limit: 25 } });
if (!response.ok) {
  const { code, message } = readProblem(response.payload, `GET /hosts failed with ${response.status}`);
}
```

| Export | What it does |
| --- | --- |
| `HttpClient` | `request({ method, path, query?, body?, headers?, absolute? })`: under `/api/v1` (or the API's root with `absolute`), the bearer credential, a timeout, empty query values left out, the body as JSON. Answers `{ status, ok, headers, payload }` whatever the status. |
| `HttpTransportError` | Thrown only when there is no answer: `kind` is `unreachable` or `timeout`. |
| `readProblem` | A failed answer's body read once: the RFC 7807 problem document's code, its detail (else its title) with the rejected fields appended, its correlation id; or an older deployment's `{ code, message }`. |

It never decides what a status means. The CLI maps one onto its exit codes and
next-step hints (`apps/cli/src/lib/client.ts`), the MCP server onto a tool
result phrased for a model (`apps/mcp/src/client.ts`).

It is a CommonJS build with no runtime dependency but `@oppenheimer/shared`'s
`types` subpath, which loads in a few milliseconds: `opp` pays it on every
command.

```bash
pnpm --filter @oppenheimer/http-client build
pnpm --filter @oppenheimer/http-client test
```
