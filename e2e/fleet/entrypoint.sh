#!/bin/bash
# One fleet host: pair once, forward the control plane onto loopback, and keep
# `runner run` alive the way launchd KeepAlive or systemd Restart=always would.
set -euo pipefail

: "${CONTROL_PLANE_UPSTREAM:?host:port of the API as this container reaches it}"
: "${HOST_NAME:=$(hostname)}"

# The runner speaks plain HTTP only to loopback (pairing/domain/identity.go), so
# the API is forwarded onto 127.0.0.1:3001 here rather than dialled across the
# bridge. The forwarder is also the host's network cable: `fleet-host cut`
# pulls it (existing connections included) and `fleet-host restore` puts it
# back, which is a link loss the runner cannot tell from a real one.
link() {
  while true; do
    if [ ! -e /tmp/fleet/link-cut ]; then
      socat TCP-LISTEN:3001,bind=127.0.0.1,fork,reuseaddr "TCP:${CONTROL_PLANE_UPSTREAM}" || true
    fi
    sleep 0.2
  done
}

case "${1:-run}" in
  cut)
    touch /tmp/fleet/link-cut
    pkill -x socat || true
    exit 0
    ;;
  restore)
    rm -f /tmp/fleet/link-cut
    exit 0
    ;;
  kill-runner)
    # SIGKILL, the runner process only: no graceful shutdown, and tmux is its
    # sibling and survives. That is "runner died", not "host rebooted" (02 §12).
    pkill -KILL -f '^runner run'
    exit 0
    ;;
  run) ;;
  *)
    echo "usage: fleet-host [run|cut|restore|kill-runner]" >&2
    exit 2
    ;;
esac

mkdir -p /tmp/fleet
link &

if [ ! -f "$HOME/.oppenheimer/config.json" ]; then
  : "${REGISTRATION_TOKEN:?a registration token minted by the API}"
  for _ in $(seq 1 50); do
    (exec 3<>/dev/tcp/127.0.0.1/3001) 2>/dev/null && break
    sleep 0.2
  done
  # A fleet host is a container on purpose, and meant to last for the run:
  # --allow-container is the deliberate answer to the guard that refuses one.
  runner register --token "$REGISTRATION_TOKEN" --url http://localhost:3001 --name "$HOST_NAME" --allow-container
fi

while true; do
  runner run || echo "fleet-host: runner exited ($?), restarting" >&2
  sleep 1
done
