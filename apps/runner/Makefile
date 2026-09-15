# Contributor entrypoints. package.json mirrors the CI-relevant ones by
# calling `go` directly, because the CI runners have no make.
GO      ?= go
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.version=$(VERSION)

.PHONY: build dev run lint test test-race vet tidy clean

build:
	CGO_ENABLED=0 $(GO) build -trimpath -ldflags "$(LDFLAGS)" -o dist/runner ./cmd/server

dev run:
	$(GO) run ./cmd/server

lint:
	golangci-lint run ./...

vet:
	$(GO) vet ./...

test:
	$(GO) test -count=1 ./...

# The race detector needs cgo and a C compiler, which the CI runners lack;
# run it locally before pushing anything concurrent.
test-race:
	CGO_ENABLED=1 $(GO) test -race -count=1 ./...

tidy:
	$(GO) mod tidy

clean:
	rm -rf dist
