# Workspace-wide Go targets. The repo root is not a module, so patterns use
# the module path; run these from anywhere with `make -C packages/go <target>`.
GO   ?= go
PKGS := github.com/jordiparracrespo/oppenheimer/...

.PHONY: build vet lint test test-race tidy

build:
	$(GO) build $(PKGS)

vet:
	$(GO) vet $(PKGS)

# The module directories are passed one NUL-delimited argument at a time:
# unquoted `$(go list -m -f '{{.Dir}}/...')` splits on the spaces in a checkout
# path, and golangci-lint then reports "directory not found" for the first half
# of it with 0 issues — a green run that linted nothing, or a red one that
# found no fault.
lint:
	$(GO) list -m -f '{{.Dir}}/...' | tr '\n' '\0' | xargs -0 golangci-lint run

test:
	$(GO) test -count=1 $(PKGS)

test-race:
	CGO_ENABLED=1 $(GO) test -race -count=1 $(PKGS)

# go mod tidy ignores go.work, which is why every module carries relative
# replaces; tidy them one by one.
tidy:
	for m in $(wildcard */go.mod) ../../apps/runner/go.mod; do (cd $$(dirname $$m) && GOWORK=off $(GO) mod tidy); done
