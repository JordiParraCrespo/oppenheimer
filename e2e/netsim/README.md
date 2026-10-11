# netsim

A network simulator for the local stack: it puts the browser and each host
on a link of its own: somewhere in the world, behind fibre, ADSL or 4G. The
relay stays where the API runs. It exists to answer one question with
numbers: how a terminal feels to type in from a given place, to a host on a
given connection, on the relay and on the direct path
(`product/versions/mvp/22-direct-terminal-path.md`).

## How it works

```
 browser ns             root ns (the relay)            host ns
 10.77.1.2   ─ sim0 ─┐  10.77.0.1 ─ netsim0 ─┐   ┌─ sim0 ─ 10.77.2.2
 localhost:3000/3001 │    API :3001, console │   │ localhost:3001, :9418
   forward to relay  │    :3000, git :9418   │   │   forward to relay
                     └──────────►  router  ◄─┴───┘
                         (this process: delay, rate, loss per packet)
```

- Every node except the relay gets a **network namespace** with one TUN
  device. The relay is the root namespace, where the API, the console and the
  git server already run. Every IPv4 packet between nodes goes through this
  process, which reads it off the source device and writes it to the
  destination's when the model says it arrives.
- The model (`model.go`) is two last miles and the distance between them.
  Each node has an **access** (`profiles.json`: latency, jitter, loss, down and
  up rate) and a **location**. A packet waits its turn on the sender's uplink
  and the receiver's downlink at their rates, then crosses both last miles plus
  the distance between the two cities. Jitter stretches a leg but never
  reorders it. A buffer more than 400 ms deep drops. Two nodes on the same
  `lan` skip the internet.
- Inside a node, loopback ports **forward** to the same port on the relay, so
  a runner registers against `localhost:3001` and the browser opens
  `localhost:3000` exactly as without the simulation. The connection is dialled
  from inside the node, so it crosses the simulated link.
- Between nodes, packets go node to node: a WebRTC path between the browser
  and a host never touches the relay's side, and the per-leg counters show it.

It needs no `netem`, so it runs on kernels built without it, like this
sandbox's. It does need Linux, root and `/dev/net/tun`.

## Running it

The bench is `e2e/tests/netsim/typing.spec.ts`; `e2e/README.md` has the
command. By hand:

```bash
go build -o /tmp/netsim ./e2e/netsim
cat > /tmp/nodes.json <<'EOF'
{
  "relay": { "location": "falkenstein", "access": "datacenter" },
  "relayPorts": [3000, 3001, 9418],
  "nodes": [
    { "name": "browser", "placement": { "location": "tokyo", "access": "4g" }, "ports": [3000, 3001] },
    { "name": "mac", "placement": { "location": "barcelona", "access": "adsl" }, "ports": [3001, 9418] }
  ]
}
EOF
sudo /tmp/netsim up --config /tmp/nodes.json --state /tmp/netsim-state &
sudo /tmp/netsim exec --state /tmp/netsim-state mac -- curl -s localhost:3001/health
```

While it runs, `127.0.0.1:7077` is its control endpoint:

| Request | Does |
| --- | --- |
| `GET /nodes` | Every node, its address and placement |
| `PUT /nodes/{name}` `{"location","access","lan"?}` | Moves a node; in-flight packets keep their times |
| `GET /stats`, `DELETE /stats` | Packets, bytes and drops per directed leg, and a reset |
| `GET /profiles` | The locations and accesses it knows |

## The numbers

`profiles.json` holds rough, typical figures: half the usual ping between two
cities, and a last mile per connection type. They are not measurements of
any particular network. They are good for comparing the two paths under the
same conditions, not for predicting one person's milliseconds. A new place
or connection is an entry there; `model_test.go` fails if a location lacks a
distance to any other.
