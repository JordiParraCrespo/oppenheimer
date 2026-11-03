package domain

// FileSharedKind is the event kind a file an agent shared is logged as
// (`runner sessions send-file`, `product/next-steps/agent-tools.md` §7): what
// the file is, never where it is on the host nor its bytes.
const FileSharedKind = "file.shared"

// SharedFile is what the control plane is told of a shared file, so a bot can
// name it and ask the host for its preview.
type SharedFile struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	MediaType  string `json:"mediaType"`
	Size       int64  `json:"size"`
	Caption    string `json:"caption,omitempty"`
	HasPreview bool   `json:"hasPreview"`
}
