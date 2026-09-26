package cli

import (
	"runtime"

	updapp "github.com/jordiparracrespo/oppenheimer/apps/runner/internal/updates/app"
)

// target is this build's release target, `os/arch`.
func (a *App) target() string { return runtime.GOOS + "/" + runtime.GOARCH }

// applyOptions is the automatic loop's policy: never force. A scheduled
// update waits for a quiet moment; only a person forces one.
func applyOptions() updapp.ApplyOptions { return updapp.ApplyOptions{} }
