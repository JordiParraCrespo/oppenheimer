package app_test

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/adapters/launchd"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/adapters/systemd"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/app"
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/service/domain"
	"github.com/jordiparracrespo/oppenheimer/packages/go/core/problem"
)

// recorder is a Commands that remembers invocations and answers canned output.
type recorder struct {
	calls  []string
	output map[string]string
	fail   map[string]error
}

func newRecorder() *recorder {
	return &recorder{output: map[string]string{}, fail: map[string]error{}}
}

func (r *recorder) Run(_ context.Context, name string, args ...string) (string, error) {
	line := strings.TrimSpace(name + " " + strings.Join(args, " "))
	r.calls = append(r.calls, line)
	for prefix, err := range r.fail {
		if strings.HasPrefix(line, prefix) {
			return r.output[prefix], err
		}
	}
	for prefix, out := range r.output {
		if strings.HasPrefix(line, prefix) {
			return out, nil
		}
	}
	return "", nil
}

func (r *recorder) ran(prefix string) bool {
	for _, c := range r.calls {
		if strings.HasPrefix(c, prefix) {
			return true
		}
	}
	return false
}

func unit(home string) domain.Unit {
	return domain.Unit{
		ExecPath:   filepath.Join(home, ".oppenheimer/bin/current"),
		Args:       []string{"run"},
		WorkingDir: home,
		LogDir:     filepath.Join(home, ".oppenheimer/log"),
		User:       "jordi",
	}
}

func TestSystemdInstallWritesTheUnitEnablesLingeringAndStarts(t *testing.T) {
	home := t.TempDir()
	cmds := newRecorder()
	dir := filepath.Join(home, ".config/systemd/user")
	manager := systemd.New(systemd.Options{Dir: dir, User: "jordi", Commands: cmds})
	svc := app.New(app.Options{Manager: manager, Unit: unit(home)})

	if _, err := svc.Install(context.Background()); err != nil {
		t.Fatalf("install: %v", err)
	}

	written, err := os.ReadFile(filepath.Join(dir, domain.SystemdUnit))
	if err != nil {
		t.Fatalf("unit file: %v", err)
	}
	if !strings.Contains(string(written), "KillMode=process") {
		t.Fatal("the installed unit must not kill the tmux server")
	}
	// Lingering before enable: a unit enabled first would not survive the
	// next reboot until someone logged in.
	if !cmds.ran("loginctl enable-linger jordi") {
		t.Fatalf("calls = %v", cmds.calls)
	}
	if !cmds.ran("systemctl --user daemon-reload") || !cmds.ran("systemctl --user enable --now "+domain.SystemdUnit) {
		t.Fatalf("calls = %v", cmds.calls)
	}
}

func TestSystemdInstallSucceedsWhenLingeringIsRefusedButSaysSo(t *testing.T) {
	home := t.TempDir()
	cmds := newRecorder()
	cmds.fail["loginctl enable-linger"] = errors.New("Access denied")
	cmds.output["systemctl --user is-active"] = "active\n"
	cmds.output["loginctl show-user"] = "Linger=no\n"
	manager := systemd.New(systemd.Options{Dir: filepath.Join(home, "units"), User: "jordi", Commands: cmds})

	status, err := app.New(app.Options{Manager: manager, Unit: unit(home)}).Install(context.Background())
	if err != nil {
		t.Fatalf("a host where lingering needs an admin still gets a running service: %v", err)
	}
	if !status.Running || !strings.Contains(status.Detail, "enable-linger") {
		t.Fatalf("status = %+v, want it to name the fix", status)
	}
}

func TestSystemdRestartIsTheUpdateHook(t *testing.T) {
	cmds := newRecorder()
	manager := systemd.New(systemd.Options{Dir: t.TempDir(), Commands: cmds})

	if err := app.New(app.Options{Manager: manager}).Restart(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !cmds.ran("systemctl --user restart " + domain.SystemdUnit) {
		t.Fatalf("calls = %v", cmds.calls)
	}
}

func TestSystemdUninstallToleratesAServiceThatWasNeverLoaded(t *testing.T) {
	cmds := newRecorder()
	cmds.fail["systemctl --user disable"] = errors.New("exit 5")
	cmds.output["systemctl --user disable"] = "Failed to disable unit: Unit file oppenheimer-runner.service does not exist, not loaded"
	manager := systemd.New(systemd.Options{Dir: t.TempDir(), Commands: cmds})

	if err := app.New(app.Options{Manager: manager}).Uninstall(context.Background()); err != nil {
		t.Fatalf("uninstall on a host with no service: %v", err)
	}
}

func TestLaunchdInstallBootsOutBeforeBootstrapping(t *testing.T) {
	home := t.TempDir()
	cmds := newRecorder()
	dir := filepath.Join(home, "Library/LaunchAgents")
	manager := launchd.New(launchd.Options{Dir: dir, UID: 501, Commands: cmds})

	if _, err := app.New(app.Options{Manager: manager, Unit: unit(home)}).Install(context.Background()); err != nil {
		t.Fatalf("install: %v", err)
	}

	plist, err := os.ReadFile(filepath.Join(dir, domain.Label+".plist"))
	if err != nil {
		t.Fatalf("plist: %v", err)
	}
	if !strings.Contains(string(plist), "AbandonProcessGroup") {
		t.Fatal("the installed agent must leave the tmux server alone")
	}
	// Re-running the installer must repair, not fail: bootstrap on a loaded
	// label is an error, so bootout comes first.
	if len(cmds.calls) < 2 || !strings.HasPrefix(cmds.calls[0], "launchctl bootout gui/501/") {
		t.Fatalf("calls = %v", cmds.calls)
	}
	if !cmds.ran("launchctl bootstrap gui/501 " + filepath.Join(dir, domain.Label+".plist")) {
		t.Fatalf("calls = %v", cmds.calls)
	}
}

func TestLaunchdRestartKickstarts(t *testing.T) {
	cmds := newRecorder()
	manager := launchd.New(launchd.Options{Dir: t.TempDir(), UID: 501, Commands: cmds})

	if err := app.New(app.Options{Manager: manager}).Restart(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !cmds.ran("launchctl kickstart -k gui/501/" + domain.Label) {
		t.Fatalf("calls = %v", cmds.calls)
	}
}

func TestLaunchdStatusReadsTheJobState(t *testing.T) {
	cmds := newRecorder()
	cmds.output["launchctl print"] = "dev.oppenheimer.runner = {\n\tstate = running\n\tpid = 4242\n}"
	manager := launchd.New(launchd.Options{Dir: t.TempDir(), UID: 501, Commands: cmds})

	status, err := app.New(app.Options{Manager: manager}).Status(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !status.Running || status.Kind != domain.KindLaunchd {
		t.Fatalf("status = %+v", status)
	}
}

func TestEveryUseCaseReportsAPlatformWithNoServiceManager(t *testing.T) {
	svc := app.New(app.Options{})

	for name, err := range map[string]error{
		"install":   mustErr(svc.Install(context.Background())),
		"restart":   svc.Restart(context.Background()),
		"uninstall": svc.Uninstall(context.Background()),
		"status":    mustStatusErr(svc.Status(context.Background())),
	} {
		var prob *problem.Error
		if !errors.As(err, &prob) || prob.Code != "SVC_001" {
			t.Fatalf("%s: err = %v, want SVC_001", name, err)
		}
	}
}

func mustErr(_ domain.Status, err error) error       { return err }
func mustStatusErr(_ domain.Status, err error) error { return err }
