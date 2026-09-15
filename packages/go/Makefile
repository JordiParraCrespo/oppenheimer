# Workspace-wide Go targets. The repo root is not a module, so patterns use
# the module path; run these from anywhere with `make -C packages/go <target>`.
GO   ?= go
PKGS := github.com/jordiparracrespo/oppenheimer/...

.PHONY: build vet lint test test-race tidy

build:
	$(GO) build $(PKGS)

vet:
	$(GO) vet $(PKGS)

lint:
	golangci-lint run $$($(GO) list -m -f '{{.Dir}}/...')

test:
	$(GO) test -count=1 $(PKGS)

test-race:
	CGO_ENABLED=1 $(GO) test -race -count=1 $(PKGS)

# go mod tidy ignores go.work, which is why every module carries relative
# replaces; tidy them one by one.
tidy:
	for m in $(wildcard */go.mod) ../../apps/runner/go.mod; do (cd $$(dirname $$m) && GOWORK=off $(GO) mod tidy); done
