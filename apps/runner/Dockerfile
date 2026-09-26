# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS builder
WORKDIR /src
ARG VERSION=dev
# The runner depends on the shared modules in packages/go through relative
# replace directives, so the workspace layout is reproduced inside the image.
COPY go.work ./
COPY packages/go/ ./packages/go/
COPY apps/runner/go.mod apps/runner/go.sum ./apps/runner/
RUN --mount=type=cache,target=/go/pkg/mod cd apps/runner && go mod download
COPY apps/runner/ ./apps/runner/
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    cd apps/runner && CGO_ENABLED=0 GOOS=linux go build -trimpath \
      -ldflags="-s -w -X main.version=${VERSION}" \
      -o /out/runner ./cmd/runner

# Distroless: no shell, no package manager, non-root by default. The binary
# is static, so nothing else is needed.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=builder /out/runner /runner
ENV RUNNER_ENV=production
EXPOSE 3006
USER nonroot:nonroot
# The container runs the control-plane-facing HTTP service. The host agent is
# `runner run`, which is installed on a machine, not in an image.
ENTRYPOINT ["/runner"]
CMD ["serve"]
