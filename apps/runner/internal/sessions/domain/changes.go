package domain

// ChangeStatus is what happened to a file, as git names it; Untracked is new
// and never added. The values are the wire's (`SESSION_CHANGE_STATUSES`).
type ChangeStatus string

const (
	ChangeAdded       ChangeStatus = "added"
	ChangeModified    ChangeStatus = "modified"
	ChangeDeleted     ChangeStatus = "deleted"
	ChangeRenamed     ChangeStatus = "renamed"
	ChangeCopied      ChangeStatus = "copied"
	ChangeTypeChanged ChangeStatus = "type_changed"
	ChangeUntracked   ChangeStatus = "untracked"
)

// ChangedFile is one file a checkout changed: its counts, and its patch once
// one was read.
type ChangedFile struct {
	// Path is relative to the checkout's root, `/`-separated as git prints it.
	Path string
	// OldPath is where a renamed or copied file came from.
	OldPath   string
	Status    ChangeStatus
	Additions int
	Deletions int
	Binary    bool
	// Patch is the file's unified diff from its `diff --git` line.
	Patch string
	// PatchOmitted says a patch was left out: past a bound, or not read in
	// the time the read had.
	PatchOmitted bool
}

// CheckoutChanges is what one checkout changed against Base.
type CheckoutChanges struct {
	Checkout Checkout
	// Base is the commit compared with; empty when there is none (a branch
	// with no commit yet), and the files are then against an empty tree.
	Base string
	// Approximate says the branch's history did not reach its base yet, so
	// the read compared with the base branch's tip rather than where the
	// branch left it.
	Approximate bool
	Files       []ChangedFile
	// OmittedFiles counts the files past the bound, left out.
	OmittedFiles int
}

// ChangesBounds is how much one read carries, the protocol's bounds
// (`packages/shared/src/protocol/session-changes.ts`), handed in by the
// link so the read never builds an answer the link would refuse.
type ChangesBounds struct {
	// Files is the most files one checkout names.
	Files int
	// FilePatch is the most bytes one file's patch carries.
	FilePatch int
	// Patches is the most bytes the patches of one read add up to.
	Patches int
}
