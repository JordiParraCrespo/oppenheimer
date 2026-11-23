package workfolder

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The guides: every directory the runner makes in the work folder carries a
// README.md, for the person, and an AGENTS.md, for an agent, saying what the
// directory is, what is in it and where to go next. The folders are named by
// ids that never change, so without them nobody could tell which workspace is
// which, or which session folder holds what.
const (
	GuideReadme = "README.md"
	GuideAgents = "AGENTS.md"
)

// guideHeader opens every guide the runner writes. A file without it is
// somebody else's and is never overwritten.
const guideHeader = "<!-- Written by the Oppenheimer runner and rewritten whenever a workspace or session changes: edits here are lost. -->"

// guides is one directory's two files; an empty one is not written.
type guides struct {
	readme string
	agents string
}

// level is one directory the guides describe.
type level struct {
	dir string
	guides
}

// workspaceInfo and sessionInfo are what the walk found, read off the markers.
type workspaceInfo struct {
	tenant   domain.Tenant
	slug     string
	sessions []sessionInfo
}

type sessionInfo struct {
	slug string
	meta Meta
}

type accountInfo struct {
	id         string
	workspaces []workspaceInfo
}

// WriteGuides writes README.md and AGENTS.md into the work folder's root and
// into every account, workspace, repos.noindex, sessions.noindex and session
// folder it holds, from their markers. It is best effort: a guide is a
// convenience, and one that cannot be written is never a reason to refuse
// the create or the close that called it. It writes nothing until the work
// folder exists.
func (f *Folder) WriteGuides() {
	f.guides.Lock()
	defer f.guides.Unlock()

	root := f.layout.Root
	if info, err := os.Stat(filepath.Join(root, LayoutFile)); err != nil || info.IsDir() {
		return
	}
	accounts := f.scan()
	levels := []level{{root, rootGuides(accounts)}}
	for _, account := range accounts {
		levels = append(levels, level{f.layout.Account(account.id), accountGuides(account)})
		for _, ws := range account.workspaces {
			levels = append(levels,
				level{f.layout.Workspace(ws.tenant), workspaceGuides(ws)},
				level{f.layout.Repos(ws.tenant), reposGuides(ws)},
				level{f.layout.Sessions(ws.tenant), sessionsGuides(ws)},
			)
			for _, session := range ws.sessions {
				levels = append(levels, level{f.layout.Session(ws.tenant, session.slug), sessionGuides(ws, session)})
			}
		}
	}
	for _, l := range levels {
		if info, err := os.Stat(l.dir); err != nil || !info.IsDir() {
			continue
		}
		if l.readme != "" {
			writeGuide(filepath.Join(l.dir, GuideReadme), l.readme)
		}
		if l.agents != "" {
			writeGuide(filepath.Join(l.dir, GuideAgents), l.agents)
		}
	}
}

// scan reads the work folder's accounts, workspaces and sessions off their
// markers. A directory without the marker its level expects is not the
// runner's, and is left out.
func (f *Folder) scan() []accountInfo {
	var accounts []accountInfo
	for _, accountName := range subdirs(f.layout.Root) {
		dir := f.layout.Account(accountName)
		if m, err := readMarker(dir); err != nil || m.Kind != KindAccount {
			continue
		}
		account := accountInfo{id: accountName}
		for _, wsName := range subdirs(dir) {
			tenant := domain.Tenant{Account: accountName, Workspace: wsName}
			m, err := readMarker(f.layout.Workspace(tenant))
			if err != nil || m.Kind != KindWorkspace {
				continue
			}
			ws := workspaceInfo{tenant: tenant, slug: m.Slug}
			for _, slug := range subdirs(f.layout.Sessions(tenant)) {
				sm, err := readMarker(f.layout.Session(tenant, slug))
				if err != nil || sm.Kind != KindSession {
					continue
				}
				ws.sessions = append(ws.sessions, sessionInfo{slug: slug, meta: sm})
			}
			account.workspaces = append(account.workspaces, ws)
		}
		accounts = append(accounts, account)
	}
	return accounts
}

// subdirs is dir's visible subdirectories, sorted.
func subdirs(dir string) []string {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var names []string
	for _, entry := range entries {
		if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") {
			names = append(names, entry.Name())
		}
	}
	slices.Sort(names)
	return names
}

// writeGuide writes content at path unless something there is not a guide
// this runner wrote (a directory a checkout is named after, a file somebody
// made), or already says the same.
func writeGuide(path, content string) {
	data := []byte(guideHeader + "\n\n" + content)
	found, err := os.ReadFile(path) // #nosec G304 -- a fixed name under a folder of the work folder
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return
	case !ours(found):
		return
	case bytes.Equal(found, data):
		return
	}
	_ = writeAtomic(path, data)
}

func ours(data []byte) bool {
	line, _, _ := bufio.NewReader(bytes.NewReader(data)).ReadLine()
	return string(line) == guideHeader
}

// The guides' text, one function per level. Names come from the control
// plane and are only ever printed, never followed.

func rootGuides(accounts []accountInfo) guides {
	var b strings.Builder
	b.WriteString("The Oppenheimer runner on this host keeps your workspaces here: each one's repositories, ")
	b.WriteString("and a folder per session with the checkout its agent works in. The runner's own files ")
	b.WriteString("(identity, binaries, logs) are in `~/.oppenheimer`, not here.\n\n")
	b.WriteString("## Workspaces\n\n")
	if countWorkspaces(accounts) == 0 {
		b.WriteString("None yet. A workspace's folder is made with its first session.\n\n")
	} else {
		b.WriteString(workspaceTableHead)
		for _, account := range accounts {
			for _, ws := range account.workspaces {
				b.WriteString(workspaceRow(ws, ws.tenant.Account+"/"+ws.tenant.Workspace))
			}
		}
		b.WriteString("\n")
	}
	fmt.Fprintf(&b, "Sessions made with `runner sessions create` on this host live under `%s/%s/`.\n\n", domain.LocalID, domain.LocalID)
	b.WriteString("## Layout\n\n")
	b.WriteString("```\n")
	b.WriteString("<account>/                        an account, named by its id\n")
	b.WriteString("  <workspace>/                    a workspace (your organization), named by its id\n")
	b.WriteString("    repos.noindex/                one bare git store per repository, managed by the runner\n")
	b.WriteString("    sessions.noindex/<session>/   one folder per session\n")
	b.WriteString("      <directory>/                the checkout the session's agent works in\n")
	b.WriteString("```\n\n")
	b.WriteString("Every folder is named by an id that never changes; its README.md says what it is. ")
	b.WriteString("`.oppenheimer/meta.json` in a folder is its marker: it says what the folder is and whose, ")
	b.WriteString("and only a folder whose marker names the session being closed is ever deleted. ")
	b.WriteString("Names end in `.noindex` so Spotlight does not index the checkouts.")
	return guides{
		readme: readmeGuide("Oppenheimer work folder", b.String()),
		agents: agentsGuide("the Oppenheimer work folder",
			"This directory is the work folder of the Oppenheimer runner: every workspace's repositories "+
				"and every session's checkout on this host. README.md beside this file lists the workspaces."),
	}
}

func accountGuides(account accountInfo) guides {
	var b strings.Builder
	if account.id == domain.LocalID {
		b.WriteString("The sessions made from this host's own CLI, which no control plane has given an account.\n\n")
	}
	b.WriteString(workspaceTableHead)
	for _, ws := range account.workspaces {
		b.WriteString(workspaceRow(ws, ws.tenant.Workspace))
	}
	title := fmt.Sprintf("account `%s`", account.id)
	return guides{
		readme: readmeGuide("Account `"+account.id+"`", b.String(), up{"the work folder", "../README.md"}),
		agents: agentsGuide(title, "One account's workspaces, one folder each, named by the workspace's id. "+
			"README.md beside this file says which is which."),
	}
}

func workspaceGuides(ws workspaceInfo) guides {
	name := cell(workspaceName(ws))
	var b strings.Builder
	fmt.Fprintf(&b, "Account `%s` · workspace `%s`", ws.tenant.Account, ws.tenant.Workspace)
	if ws.slug != "" {
		fmt.Fprintf(&b, " · slug `%s`", ws.slug)
	}
	b.WriteString("\n\n")
	b.WriteString("- [`repos.noindex/`](repos.noindex/README.md): one bare git store per repository, which every session's checkout is a worktree of\n")
	b.WriteString("- [`sessions.noindex/`](sessions.noindex/README.md): one folder per session\n\n")
	b.WriteString("## Sessions\n\n")
	b.WriteString(sessionTable(ws, "sessions.noindex/"))
	return guides{
		readme: readmeGuide("Workspace "+name, b.String(),
			up{"the account", "../README.md"}, up{"the work folder", "../../README.md"}),
		agents: agentsGuide("workspace "+name,
			"`repos.noindex/` holds this workspace's bare git stores; `sessions.noindex/` holds one folder per "+
				"session, and each session's checkout is inside its folder. README.md beside this file lists the sessions."),
	}
}

func reposGuides(ws workspaceInfo) guides {
	title := "repositories of " + cell(workspaceName(ws))
	return guides{
		readme: readmeGuide("Repositories of "+cell(workspaceName(ws)),
			"One bare git store per repository, `<owner>--<repo>.git`, cloned once and fetched before each "+
				"session is made; every session's checkout is a worktree of one of them. `.spares/` holds a worktree "+
				"made ahead of time, which the next session over that repository takes.\n\n"+
				"The runner manages everything here: there is no working copy to edit. Your work is in each "+
				"session's checkout, under [`../sessions.noindex/`](../sessions.noindex/README.md).",
			up{"the workspace", "../README.md"}),
		agents: agentsGuide(title, "Bare git stores and spare worktrees the runner manages. Do not edit, fetch into "+
			"or delete anything here: work in your session's checkout, which is a worktree of one of these stores."),
	}
}

func sessionsGuides(ws workspaceInfo) guides {
	name := cell(workspaceName(ws))
	return guides{
		readme: readmeGuide("Sessions of "+name,
			"One folder per session, named by the session's slug. Each holds its checkouts; "+
				"the folder and everything in it is deleted when the session is closed.\n\n"+sessionTable(ws, ""),
			up{"the workspace", "../README.md"}),
		agents: agentsGuide("sessions of "+name, "One folder per session. Yours is the one whose checkout you were "+
			"started in; every other one belongs to another session, which may be working in it right now."),
	}
}

// sessionGuides leaves out a guide whose name a checkout takes, in any case
// (a Mac's disk does not tell them apart): the worktree is made after the
// guides, and must find its path free.
func sessionGuides(ws workspaceInfo, session sessionInfo) guides {
	m := session.meta
	name, wsName := cell(sessionName(session)), cell(workspaceName(ws))

	var b strings.Builder
	fmt.Fprintf(&b, "Workspace %s · session `%s`", wsName, m.ID)
	if m.Agent != "" {
		fmt.Fprintf(&b, " · agent `%s`", m.Agent)
	}
	if m.Branch != "" {
		fmt.Fprintf(&b, " · branch `%s`", m.Branch)
	}
	if m.CreatedAt != nil {
		fmt.Fprintf(&b, " · created %s", m.CreatedAt.UTC().Format(createdFormat))
	}
	b.WriteString("\n\n")
	if len(m.Checkouts) > 0 {
		b.WriteString("| Checkout | Repository |\n| --- | --- |\n")
		for _, checkout := range m.Checkouts {
			fmt.Fprintf(&b, "| [`%s/`](%s/) | %s |\n", checkout.Directory, checkout.Directory, cell(checkout.Repo))
		}
		b.WriteString("\nThe agent works in the checkout; each one is a git worktree on the session's branch. ")
	}
	b.WriteString("Closing the session deletes this folder.")

	var a strings.Builder
	fmt.Fprintf(&a, "The folder of session `%s` in workspace %s.", m.ID, wsName)
	if len(m.Checkouts) > 0 {
		dirs := make([]string, 0, len(m.Checkouts))
		for _, checkout := range m.Checkouts {
			dirs = append(dirs, "`"+checkout.Directory+"/` ("+cell(checkout.Repo)+")")
		}
		fmt.Fprintf(&a, " Its code is in %s", strings.Join(dirs, ", "))
		if m.Branch != "" {
			fmt.Fprintf(&a, ", on branch `%s`", m.Branch)
		}
		a.WriteString(".")
	}
	a.WriteString(" Everything here is deleted when the session is closed: anything worth keeping is committed and pushed.")

	g := guides{
		readme: readmeGuide("Session "+name, b.String(),
			up{"the sessions", "../README.md"}, up{"the workspace", "../../README.md"}),
		agents: agentsGuide("session "+name, a.String()),
	}
	for _, checkout := range m.Checkouts {
		switch {
		case strings.EqualFold(checkout.Directory, GuideReadme):
			g.readme = ""
		case strings.EqualFold(checkout.Directory, GuideAgents):
			g.agents = ""
		}
	}
	return g
}

// up is a link from a README.md to one above it.
type up struct{ label, path string }

// readmeGuide is every README.md: its title, its body, and the links up.
func readmeGuide(title, body string, ups ...up) string {
	text := "# " + title + "\n\n" + strings.TrimRight(body, "\n") + "\n"
	if len(ups) > 0 {
		links := make([]string, 0, len(ups))
		for _, u := range ups {
			links = append(links, "["+u.label+"]("+u.path+")")
		}
		text += "\nUp: " + strings.Join(links, " · ") + "\n"
	}
	return text
}

// agentsGuide is every AGENTS.md: where the agent is, then the rules.
func agentsGuide(title, body string) string {
	return "# AGENTS.md: " + title + "\n\n" + body + "\n\n" + agentRules
}

const workspaceTableHead = "| Workspace | Folder | Sessions |\n| --- | --- | --- |\n"

// workspaceRow is a workspace's row in a table of them, linked at path.
func workspaceRow(ws workspaceInfo, path string) string {
	return fmt.Sprintf("| %s | [`%s/`](%s/README.md) | %d |\n", cell(workspaceName(ws)), path, path, len(ws.sessions))
}

// agentRules closes every AGENTS.md.
const agentRules = "## Rules\n\n" +
	"- Work in your own session's checkout. Another session's folder is another agent's work in progress: " +
	"read it if you must, never change it.\n" +
	"- Never edit or delete `repos.noindex/` (the runner's git stores), a `.oppenheimer/` marker, " +
	"or these README.md and AGENTS.md files, which the runner rewrites.\n" +
	"- To start another session, report to the one that started you, or tell the person something, " +
	"use `runner sessions …`; `runner --skill` is the manual.\n"

const createdFormat = "2006-01-02 15:04 UTC"

func countWorkspaces(accounts []accountInfo) int {
	n := 0
	for _, account := range accounts {
		n += len(account.workspaces)
	}
	return n
}

// sessionTable lists a workspace's sessions, each linked at prefix+slug.
func sessionTable(ws workspaceInfo, prefix string) string {
	if len(ws.sessions) == 0 {
		return "None open.\n"
	}
	var b strings.Builder
	b.WriteString("| Session | Repositories | Branch | Agent | Created | Folder |\n| --- | --- | --- | --- | --- | --- |\n")
	for _, session := range ws.sessions {
		m := session.meta
		repos := make([]string, 0, len(m.Checkouts))
		for _, checkout := range m.Checkouts {
			repos = append(repos, checkout.Repo)
		}
		created := ""
		if m.CreatedAt != nil {
			created = m.CreatedAt.UTC().Format(createdFormat)
		}
		fmt.Fprintf(&b, "| %s | %s | %s | %s | %s | [`%s%s/`](%s%s/README.md) |\n",
			cell(sessionName(session)), cell(strings.Join(repos, ", ")), code(m.Branch), code(m.Agent), created,
			prefix, session.slug, prefix, session.slug)
	}
	return b.String()
}

func workspaceName(ws workspaceInfo) string {
	if ws.slug != "" {
		return ws.slug
	}
	if ws.tenant.Workspace == domain.LocalID {
		return "local (this host's CLI)"
	}
	return ws.tenant.Workspace
}

func sessionName(session sessionInfo) string {
	if session.meta.Name != "" {
		return session.meta.Name
	}
	return session.slug
}

// cell makes text safe inside one Markdown table cell or heading line.
func cell(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	return strings.NewReplacer("|", `\|`, "<", "&lt;", ">", "&gt;").Replace(text)
}

func code(text string) string {
	if text == "" {
		return ""
	}
	return "`" + strings.ReplaceAll(cell(text), "`", "'") + "`"
}
