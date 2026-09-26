# A host for the fleet suite: one container is one machine a user owns, with
# its own Unix account, home, tmux server and host key — the shape the product
# assumes (one runner per host, product/versions/mvp/02-runner.md §1).
#
# The runner is not built here. `support/fleet.ts` builds it once on the
# machine running the suite and hands it in as the `runner` build context, so
# every host in a run is the same binary and an image rebuild costs seconds.
FROM debian:12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates git tmux socat procps \
 && rm -rf /var/lib/apt/lists/*
RUN useradd --create-home --shell /bin/bash dev
COPY --from=runner runner /usr/local/bin/runner
COPY claude /usr/local/bin/claude
COPY grok /usr/local/bin/grok
COPY entrypoint.sh /usr/local/bin/fleet-host
COPY git-server.sh /usr/local/bin/fleet-git-server
USER dev
WORKDIR /home/dev
# The runner clones `https://github.com/<owner>/<repo>.git`. In the fleet that
# is the git-server container, so the repositories the GitHub stub lists exist
# without GitHub, and the runner is none the wiser.
RUN git config --global url."git://git-server/".insteadOf "https://github.com/" \
 && git config --global user.name "Fleet host" \
 && git config --global user.email "fleet@oppenheimer.test"
ENTRYPOINT ["/usr/local/bin/fleet-host"]
