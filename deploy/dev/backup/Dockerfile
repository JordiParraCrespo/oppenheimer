# The dump sidecar: Postgres client tools of the same major as the server,
# plus age to encrypt the dump to a public key before anything with internet
# access can read it. Built by .github/workflows/deploy-dev.yml; the sidecar
# runs on the internal `data` network, so nothing can be installed at run time.
FROM postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea
RUN apk add --no-cache age
COPY dump.sh /usr/local/bin/
ENTRYPOINT ["/bin/sh", "/usr/local/bin/dump.sh"]
