package domain_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func TestSlugNamesTheWorktreeAfterTheBranch(t *testing.T) {
	id := "nkuxganccspr"

	for name, tc := range map[string]struct{ branch, want string }{
		"a session branch says the id once": {domain.DefaultBranchName(id), "oppenheimer-" + id},
		"a feature branch keeps the id":     {"feat/login", "feat-login-" + id},
		"slashes and dots are flattened":    {"release/1.2.x", "release-1-2-x-" + id},
		"an empty branch falls back":        {"", id},
	} {
		t.Run(name, func(t *testing.T) {
			if got := domain.Slug(tc.branch, id); got != tc.want {
				t.Fatalf("Slug(%q) = %q, want %q", tc.branch, got, tc.want)
			}
		})
	}
}

func TestSlugStaysAUsableDirectoryName(t *testing.T) {
	slug := domain.Slug(strings.Repeat("very-long-branch-name/", 10), "abcdefghijkl")

	if len(slug) > 64 {
		t.Fatalf("slug is %d characters: %q", len(slug), slug)
	}
	if strings.ContainsAny(slug, "/\\ .") {
		t.Fatalf("slug %q must be a plain directory name", slug)
	}
}

func TestValidateRefusesWhatWouldEscapeOrConfuseGit(t *testing.T) {
	for _, repo := range []string{"../etc", "owner/../../etc", "owner", "", "own er/repo"} {
		if err := domain.ValidateRepo(repo); err == nil {
			t.Fatalf("ValidateRepo(%q) must fail", repo)
		}
	}
	if err := domain.ValidateRepo("jordi/oppenheimer"); err != nil {
		t.Fatalf("a normal repository must be accepted: %v", err)
	}

	for _, branch := range []string{"../../etc/passwd", "-x", "feat/", "feat..x", "x.lock", ""} {
		if err := domain.ValidateBranch(branch); err == nil {
			t.Fatalf("ValidateBranch(%q) must fail", branch)
		}
	}
	for _, branch := range []string{"main", "feat/login", "oppenheimer/abc123", "release-1.2"} {
		if err := domain.ValidateBranch(branch); err != nil {
			t.Fatalf("ValidateBranch(%q): %v", branch, err)
		}
	}
}

func TestIDsAreUnguessableAndTmuxSafe(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 500; i++ {
		id, err := domain.NewID()
		if err != nil {
			t.Fatal(err)
		}
		if len(id) != 12 || strings.ContainsAny(id, ":.$ /") {
			t.Fatalf("id %q is not usable as a tmux session name", id)
		}
		if seen[id] {
			t.Fatalf("duplicate id %q", id)
		}
		seen[id] = true
	}
}

func TestNextWindowNeverReusesAClosedTabsNumber(t *testing.T) {
	session := domain.Session{Windows: []domain.Window{{Index: 0}, {Index: 3}}}

	if got := session.NextWindow(); got != 4 {
		t.Fatalf("NextWindow = %d, want 4: a reused number would confuse an attached client", got)
	}
}

func TestOnlyLiveStatesExpectATmuxSession(t *testing.T) {
	for _, state := range []domain.State{domain.StateStarting, domain.StateWorking, domain.StateBlocked, domain.StateIdle, domain.StateDone, domain.StateUnknown} {
		if !state.Live() {
			t.Fatalf("%q must be live", state)
		}
	}
	for _, state := range []domain.State{domain.StateStopped, domain.StateClosed} {
		if state.Live() {
			t.Fatalf("%q must not be live", state)
		}
	}
}

// The work folder is named by ids that never change (24 §2): an agent keys its
// own history on its working directory, so a path that moved when a slug was
// edited would strand every conversation the session had. A store is bare and
// named `<owner>--<repo>.git` beside the sessions, and its spare beside it.
// Both directories that hold checkouts end in `.noindex`, so Spotlight skips
// them: a host whose sessions are indexed spends its CPU on mdworker.
func TestTheWorkFolderIsNamedByAccountWorkspaceAndSession(t *testing.T) {
	layout := domain.Layout{Root: "/home/jordi/oppenheimer"}
	tenant := domain.Tenant{Account: "acct-1", Workspace: "ws-1"}
	repo := domain.Repository{Tenant: tenant, FullName: "acme-labs/xrp-mobile", GithubID: 42}

	for got, want := range map[string]string{
		layout.Workspace(tenant):            "/home/jordi/oppenheimer/acct-1/ws-1",
		layout.Store(repo):                  "/home/jordi/oppenheimer/acct-1/ws-1/repos.noindex/acme-labs--xrp-mobile.git",
		layout.Spare(layout.Store(repo)):    "/home/jordi/oppenheimer/acct-1/ws-1/repos.noindex/.spares/acme-labs--xrp-mobile",
		layout.Session(tenant, "fix-login"): "/home/jordi/oppenheimer/acct-1/ws-1/sessions.noindex/fix-login",
	} {
		if got != want {
			t.Errorf("got %q, want %q", got, want)
		}
	}
	if domain.DirectoryOf("acme-labs/xrp-mobile") != "xrp-mobile" {
		t.Fatalf("a checkout with no name of its own is named after its repository")
	}
}

// Every level of the work folder is joined from something the control plane
// sent; one that could climb out of its parent would let a frame name a
// folder the runner later deletes.
func TestAWorkFolderNameNeverLeavesItsParent(t *testing.T) {
	for _, bad := range []string{"", ".", "..", "../x", "a/b", ".hidden", "a..b", "-x", strings.Repeat("a", 129)} {
		if domain.ValidateName(bad) == nil {
			t.Errorf("%q was accepted as a folder name", bad)
		}
	}
	for _, good := range []string{"local", "fix-login", "3f1c9a2e-0b6d-4a51-9d1e-7c0b5d2a9e11", "repo.js"} {
		if err := domain.ValidateName(good); err != nil {
			t.Errorf("%q: %v", good, err)
		}
	}
	if (domain.Tenant{Account: "local", Workspace: "../etc"}).Validate() == nil {
		t.Fatal("a workspace id that climbs out was accepted")
	}
}

// A state file an older runner wrote knew one checkout, inline; it still
// loads as a session of that one checkout.
func TestASessionSavedWithOneCheckoutLoadsAsOne(t *testing.T) {
	saved := `{"id":"a","place":"worktree","dir":"/w/s","repo":"jordi/web","baseBranch":"main",
		"branch":"oppenheimer/a","worktree":"/w/s/web","checkoutId":"c-web","githubRepoId":1,"state":"stopped"}`
	var session domain.Session
	if err := json.Unmarshal([]byte(saved), &session); err != nil {
		t.Fatal(err)
	}
	checkouts := session.Checkouts()
	if len(checkouts) != 1 || checkouts[0].CheckoutID != "c-web" || session.Cwd() != "/w/s/web" {
		t.Fatalf("checkouts = %+v, cwd = %q", checkouts, session.Cwd())
	}
}

// The credential helper names the repository by the path git hands it. A
// session of one checkout answers for it whatever the path; one of several
// answers only for a path that names one of them.
func TestCheckoutForPicksTheRepositoryByPath(t *testing.T) {
	one := domain.Session{Place: domain.PlaceWorktree, Dir: "/w/s", Repo: "jordi/web", Worktree: "/w/s/web", CheckoutID: "c-web"}
	two := one
	two.More = []domain.Checkout{{Repo: "jordi/api", Worktree: "/w/s/api", CheckoutID: "c-api"}}

	for name, tc := range map[string]struct {
		session domain.Session
		path    string
		want    string
	}{
		"one checkout, no path":            {one, "", "c-web"},
		"one checkout, an old name":        {one, "jordi/old-web.git", "c-web"},
		"two checkouts, the second":        {two, "jordi/api.git", "c-api"},
		"two checkouts, by case and slash": {two, "/Jordi/Web", "c-web"},
		"two checkouts, no path":           {two, "", ""},
		"two checkouts, another repo":      {two, "jordi/other.git", ""},
	} {
		t.Run(name, func(t *testing.T) {
			checkout, ok := tc.session.CheckoutFor(tc.path)
			if got := checkout.CheckoutID; ok != (tc.want != "") || got != tc.want {
				t.Fatalf("CheckoutFor(%q) = %q, %v; want %q", tc.path, got, ok, tc.want)
			}
		})
	}
	if two.Cwd() != "/w/s" {
		t.Fatalf("a session of two runs in %q, want its folder", two.Cwd())
	}
}
