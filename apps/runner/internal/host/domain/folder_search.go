package domain

import (
	"sort"
	"strings"
)

// The bounds of the folder picker's search (`fs.find`, 24 §4): how deep the
// walk goes under where it starts, how many directories it reads before it
// stops and says so, and how many folders it names. The depth and the
// results are the protocol's FS_FIND_MAX_DEPTH and FS_FIND_MAX_RESULTS.
const (
	MaxFindDepth   = 4
	MaxFindReads   = 20000
	MaxFoundFolder = 50
)

// unsearched are directory names the search neither names nor walks into:
// dependency trees and caches nobody opens a session in, and the ones that
// make a home directory slow to walk.
var unsearched = map[string]bool{
	"node_modules": true, "vendor": true, "target": true, "__pycache__": true,
	"venv": true, "site-packages": true, "Library": true,
}

// Searchable says whether the search names a directory called name and walks
// into it: not a hidden one, and not one of the dependency trees.
func Searchable(name string) bool {
	return name != "" && !strings.HasPrefix(name, ".") && !unsearched[name]
}

// FoundFolder is one directory the search found, and the branch its checkout
// is on when it is a git repository.
type FoundFolder struct {
	Path   string
	Branch string
	// Depth is how many levels under the search's start it is.
	Depth int
	rank  int
}

// FolderSearch is what a search found under Path: its best matches, and
// whether it stopped before it had looked everywhere, or found more than it
// names.
type FolderSearch struct {
	Path      string
	Home      string
	Entries   []FoundFolder
	Truncated bool
}

// MatchFolder says whether a directory called name answers query, which is
// already lower case, and how well: 0 when the name is the query, 1 when it
// starts with it, 2 when it holds it anywhere.
func MatchFolder(name, query string) (rank int, ok bool) {
	lower := strings.ToLower(name)
	switch {
	case lower == query:
		return 0, true
	case strings.HasPrefix(lower, query):
		return 1, true
	case strings.Contains(lower, query):
		return 2, true
	}
	return 0, false
}

// Found makes a FoundFolder ranked by MatchFolder.
func Found(path, branch string, depth, rank int) FoundFolder {
	return FoundFolder{Path: path, Branch: branch, Depth: depth, rank: rank}
}

// BestFound orders found the way a person scans them, the closest name first,
// then the shallowest, then by path, and keeps MaxFoundFolder. cut says some
// were left out.
func BestFound(found []FoundFolder) (kept []FoundFolder, cut bool) {
	sort.SliceStable(found, func(i, j int) bool {
		a, b := found[i], found[j]
		if a.rank != b.rank {
			return a.rank < b.rank
		}
		if a.Depth != b.Depth {
			return a.Depth < b.Depth
		}
		return strings.ToLower(a.Path) < strings.ToLower(b.Path)
	})
	if len(found) > MaxFoundFolder {
		return found[:MaxFoundFolder], true
	}
	return found, false
}
