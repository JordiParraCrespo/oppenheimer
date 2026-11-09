package cli

// `fs.list` and `fs.find`: the folder picker's directories and its search by
// name (24 §4), read through the host context and answered with `fs.listing`
// or `fs.found`, or `command.failed` with an FS_* code.

import (
	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/link"
)

func (h *linkHandler) listFolders(m link.FsList) {
	listing, err := h.app.Host.ListFolders(m.Path)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	out := link.FsListing{
		Type: link.TypeFsListing, CommandID: m.CommandID,
		Path: listing.Path, Home: listing.Home, Branch: listing.Branch,
		Entries: make([]link.FsListingEntries, 0, len(listing.Entries)), Truncated: listing.Truncated,
	}
	if listing.Parent != "" {
		parent := listing.Parent
		out.Parent = &parent
	}
	for _, entry := range listing.Entries {
		out.Entries = append(out.Entries, link.FsListingEntries{Name: entry.Name, Branch: entry.Branch})
	}
	_ = h.client.Send(out)
}

func (h *linkHandler) findFolders(m link.FsFind) {
	search, err := h.app.Host.FindFolders(m.Path, m.Query)
	if err != nil {
		h.fail(m.CommandID, err)
		return
	}
	out := link.FsFound{
		Type: link.TypeFsFound, CommandID: m.CommandID, Path: search.Path, Home: search.Home,
		Entries: make([]link.FsFoundEntries, 0, len(search.Entries)), Truncated: search.Truncated,
	}
	for _, entry := range search.Entries {
		out.Entries = append(out.Entries, link.FsFoundEntries{Path: entry.Path, Branch: entry.Branch})
	}
	_ = h.client.Send(out)
}
