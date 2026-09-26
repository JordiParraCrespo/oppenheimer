// Package domain is the update policy: what a release is, whether this host
// should take it, when it is safe to, and what a failed update looks like on
// the way back. It contains no I/O — the manifest arrives already verified,
// because verification is a mechanism and lives in packages/go/selfupdate.
package domain

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
)

// Timings of the update loop. They are policy, so they live here and are
// referenced by the daemon rather than redeclared in it.
const (
	// CheckInterval is how often a runner asks whether there is a newer
	// version, on top of the check at boot and any heartbeat hint.
	CheckInterval = 6 * time.Hour
	// SafeWindowCap is how long an update waits for a quiet moment before
	// applying anyway. A day of busy sessions is not a reason to run an old
	// runner forever.
	SafeWindowCap = 24 * time.Hour
	// UrgentDelay is the longest an urgent or required update waits.
	UrgentDelay = 15 * time.Minute
	// BootDeadline is how long the new binary has to come up.
	BootDeadline = 60 * time.Second
	// HealthGate is how long it must stay up before the update counts.
	HealthGate = 5 * time.Minute
	// MaxAttempts is how many times a pending update may boot before the
	// runner decides the new version is the problem and rolls back.
	MaxAttempts = 2
	// KeepVersions is how many installed versions survive a prune: the
	// running one and the one a rollback returns to.
	KeepVersions = 2
)

// Sentinel conditions.
var (
	ErrNoRelease   = errors.New("no release is available for this host")
	ErrNotNewer    = errors.New("the offered version is not newer")
	ErrPinned      = errors.New("this host is pinned to a version")
	ErrUnsupported = errors.New("this runner is older than the control plane supports")
)

// Artifact is one downloadable build, already narrowed to this host's target.
type Artifact struct {
	URL    string
	SHA256 string
	Size   int64
}

// Release is a verified manifest, reduced to what the policy needs.
type Release struct {
	Channel      string
	Version      string
	MinSupported string
	Notes        string
	Artifact     Artifact
	// Urgent marks a release that skips the safe window: a security fix, or
	// a control plane that will not talk to this version any more.
	Urgent bool
}

// Activity is what the host is doing right now, and the only input to the
// safe window. It comes from the sessions context once that exists; until
// then an idle host is the honest answer, because there are no sessions.
type Activity struct {
	WorkingSessions int
	AttachedClients int
}

// Quiet reports a moment where restarting the runner costs nothing visible.
// Sessions themselves survive either way — they live in tmux — but a person
// watching a terminal would see a reconnect, and that is worth waiting out.
func (a Activity) Quiet() bool { return a.WorkingSessions == 0 && a.AttachedClients == 0 }

// Action is what Plan decided.
type Action string

// Actions.
const (
	// ActionNone: nothing to do.
	ActionNone Action = "none"
	// ActionUpdate: a newer version exists and should be taken at a quiet
	// moment, or once the wait has run out.
	ActionUpdate Action = "update"
	// ActionUpdateNow: apply without waiting — urgent, required, or asked
	// for by a human.
	ActionUpdateNow Action = "now"
	// ActionBlocked: an update is available but this host will not take it.
	ActionBlocked Action = "blocked"
)

// Plan is the decision, with the reason a human should be shown.
type Plan struct {
	Action  Action
	From    string
	To      string
	Reason  string
	Release Release
}

// Decide answers whether this host takes this release.
//
// The order matters. A runner the control plane refuses to talk to is broken
// now, so it updates whatever else is true — including a pin, which is a
// preference, not a reason to stay unreachable.
func Decide(current string, release Release, pinned string, activity Activity, waitedSince time.Time, now time.Time) Plan {
	plan := Plan{From: current, To: release.Version, Release: release}
	if release.Version == "" {
		plan.Action, plan.Reason = ActionNone, "no release is available for this host"
		return plan
	}
	required := release.MinSupported != "" && Compare(current, release.MinSupported) < 0
	if required {
		plan.Action = ActionUpdateNow
		plan.Reason = fmt.Sprintf("this runner is %s and the control plane requires at least %s", current, release.MinSupported)
		return plan
	}
	if pinned != "" {
		plan.Action = ActionBlocked
		plan.To = pinned
		plan.Reason = fmt.Sprintf("this host is pinned to %s; run `runner update --unpin` to follow the channel again", pinned)
		return plan
	}
	if Compare(release.Version, current) <= 0 {
		plan.Action, plan.Reason = ActionNone, fmt.Sprintf("%s is already the newest version on the %s channel", current, release.Channel)
		return plan
	}
	switch {
	case release.Urgent:
		plan.Action, plan.Reason = ActionUpdateNow, "the release is marked urgent"
	case activity.Quiet():
		plan.Action, plan.Reason = ActionUpdateNow, "no session is working and nobody is attached"
	case !waitedSince.IsZero() && now.Sub(waitedSince) >= SafeWindowCap:
		plan.Action, plan.Reason = ActionUpdateNow, fmt.Sprintf("waited %s for a quiet moment", SafeWindowCap)
	default:
		plan.Action = ActionUpdate
		plan.Reason = fmt.Sprintf("%d session(s) working, %d client(s) attached; waiting for a quiet moment",
			activity.WorkingSessions, activity.AttachedClients)
	}
	return plan
}

// Phase is where a recorded update got to.
type Phase string

// Phases.
const (
	PhasePending Phase = "pending"
	PhaseHealthy Phase = "healthy"
	PhaseFailed  Phase = "failed"
	PhaseRolled  Phase = "rolled-back"
)

// State is update.json: what the last update did, and how many times the new
// binary has tried to boot. It is the only thing standing between a bad
// release and a host that flaps forever.
type State struct {
	From      string    `json:"from"`
	To        string    `json:"to"`
	Phase     Phase     `json:"phase"`
	Attempts  int       `json:"attempts"`
	StartedAt time.Time `json:"startedAt"`
	ChangedAt time.Time `json:"changedAt"`
	Error     string    `json:"error,omitempty"`
	// WaitingSince is when a quiet moment was first waited for, so the cap
	// survives a restart instead of resetting with the process.
	WaitingSince time.Time `json:"waitingSince,omitempty"`
}

// ShouldRollBack reports a pending update that has burned its attempts: the
// new binary booted, did not reach the health gate, and booted again.
func (s State) ShouldRollBack(running string) bool {
	return s.Phase == PhasePending && s.To == running && s.From != "" && s.Attempts >= MaxAttempts
}

// Healthy returns the state marked good.
func (s State) Healthy(now time.Time) State {
	s.Phase, s.ChangedAt, s.Error = PhaseHealthy, now, ""
	return s
}

// Compare orders two versions the way a release train does: numeric segments
// compare numerically, a prerelease sorts before its release, and anything
// unparseable (`dev`, a git describe of an untagged build) sorts lowest, so a
// development binary is never treated as newer than a real release.
func Compare(a, b string) int {
	if a == b {
		return 0
	}
	aMain, aPre, aOK := split(a)
	bMain, bPre, bOK := split(b)
	switch {
	case !aOK && !bOK:
		return strings.Compare(a, b)
	case !aOK:
		return -1
	case !bOK:
		return 1
	}
	for i := 0; i < 3; i++ {
		if aMain[i] != bMain[i] {
			if aMain[i] < bMain[i] {
				return -1
			}
			return 1
		}
	}
	switch {
	case aPre == bPre:
		return 0
	case aPre == "":
		return 1 // 1.2.3 is newer than 1.2.3-beta.1
	case bPre == "":
		return -1
	default:
		return strings.Compare(aPre, bPre)
	}
}

func split(v string) (parts [3]int, prerelease string, ok bool) {
	v = strings.TrimPrefix(strings.TrimSpace(v), "v")
	if v == "" {
		return parts, "", false
	}
	main, pre, _ := strings.Cut(v, "-")
	fields := strings.Split(main, ".")
	if len(fields) != 3 {
		return parts, "", false
	}
	for i, f := range fields {
		n, err := strconv.Atoi(f)
		if err != nil || n < 0 {
			return parts, "", false
		}
		parts[i] = n
	}
	return parts, pre, true
}
