package transcript

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
	"unicode/utf8"
)

// SharedEntryType names the chat entry for a file an agent showed the person
// (`runner sessions send-file`): its name, where it is on the host, what it
// is, and as much of it as the chat has room for — a JPEG preview of an
// image, the text of a small text file. The file itself stays on the host
// (`product/next-steps/agent-tools.md` §1).
const SharedEntryType = "oppenheimer.file"

const (
	// SharedEntryMax bounds a shared file's entry, under the link's 64 KB
	// for one chat entry with room to spare.
	SharedEntryMax = 60 << 10
	// SharedReadMax is the largest file read to make a preview of; a larger
	// one is named in the chat, never read.
	SharedReadMax = 25 << 20
	// sharedTextMax is the largest text file whose text goes in the entry.
	sharedTextMax = 32 << 10
	// sharedCaptionMax bounds the agent's line about the file, in bytes.
	sharedCaptionMax = 500
	// sharedDir is the folder under a session's files where its shared
	// files' entries are kept, so the session's own clean-up takes them.
	sharedDir = "shared"
)

// Shared is one file an agent shared, as the chat entry the console reads.
type Shared struct {
	Type      string           `json:"type"`
	ID        string           `json:"id"`
	Timestamp string           `json:"timestamp"`
	Name      string           `json:"name"`
	Path      string           `json:"path"`
	Size      int64            `json:"size"`
	MediaType string           `json:"media_type"`
	Caption   string           `json:"caption,omitempty"`
	Preview   *chatImageSource `json:"preview,omitempty"`
	Text      *string          `json:"text,omitempty"`
}

// Errors a share is refused with; the session service turns each into the
// problem the command prints.
var (
	ErrSharedNotFile = errors.New("not a regular file")
	ErrSharedRead    = errors.New("cannot read the file")
)

// SaveShared keeps the entry for one file a session's agent shared, under
// the session's folder in filesDir, written whole (a temp file, renamed) so
// the follower never reads half of one. now names when it was shared.
func SaveShared(filesDir, sessionID, path, caption string, now time.Time) (Shared, error) {
	if !conversationPattern.MatchString(sessionID) {
		return Shared{}, fmt.Errorf("session id %q", sessionID)
	}
	info, err := os.Stat(path)
	if err != nil {
		return Shared{}, fmt.Errorf("%w: %w", ErrSharedRead, err)
	}
	if !info.Mode().IsRegular() {
		return Shared{}, ErrSharedNotFile
	}
	id, err := sharedID()
	if err != nil {
		return Shared{}, err
	}
	shared := Shared{
		Type: SharedEntryType, ID: id, Timestamp: now.UTC().Format(time.RFC3339Nano),
		Name: filepath.Base(path), Path: path, Size: info.Size(),
		Caption: clip(strings.TrimSpace(caption), sharedCaptionMax),
	}
	var data []byte
	if info.Size() <= SharedReadMax {
		data, err = readAtMost(path, SharedReadMax)
		if err != nil {
			return Shared{}, fmt.Errorf("%w: %w", ErrSharedRead, err)
		}
	}
	shared.MediaType = mediaTypeOf(path, data)
	fill(&shared, data)
	encoded, err := json.Marshal(shared)
	if err != nil {
		return Shared{}, err
	}
	if len(encoded) > SharedEntryMax {
		// Text JSON escapes (`<` is six bytes) can outgrow the raw size the
		// text was allowed at; the file then goes by name, as a large one does.
		shared.Text, shared.Preview = nil, nil
		if encoded, err = json.Marshal(shared); err != nil {
			return Shared{}, err
		}
	}
	dir := filepath.Join(filesDir, sessionID, sharedDir)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return Shared{}, err
	}
	temp, err := os.CreateTemp(dir, ".shared-*")
	if err != nil {
		return Shared{}, err
	}
	defer func() { _ = os.Remove(temp.Name()) }()
	if _, err := temp.Write(encoded); err != nil {
		_ = temp.Close()
		return Shared{}, err
	}
	if err := temp.Close(); err != nil {
		return Shared{}, err
	}
	// Named by when, so a listing reads them in the order they were shared.
	name := fmt.Sprintf("%020d-%s.json", now.UnixNano(), id)
	if err := os.Rename(temp.Name(), filepath.Join(dir, name)); err != nil {
		return Shared{}, err
	}
	return shared, nil
}

// fill puts in the entry what fits of the file: a preview of an image, or
// the text of a small text file; neither when the file was not read.
func fill(shared *Shared, data []byte) {
	if data == nil {
		return
	}
	bare, err := json.Marshal(shared)
	if err != nil {
		return
	}
	room := SharedEntryMax - len(bare) - previewOverhead
	if strings.HasPrefix(shared.MediaType, "image/") && room >= previewMinBytes {
		shared.Preview = previewBytes(data, room)
		return
	}
	if isText(shared.MediaType) && len(data) <= sharedTextMax && utf8.Valid(data) {
		text := string(data)
		shared.Text = &text
	}
}

// mediaTypeOf is what the file is: by its extension, else by its first
// bytes. Text without a charset reads as plain text.
func mediaTypeOf(path string, data []byte) string {
	if byExt := mime.TypeByExtension(strings.ToLower(filepath.Ext(path))); byExt != "" {
		if parsed, _, err := mime.ParseMediaType(byExt); err == nil {
			return parsed
		}
	}
	if data == nil {
		return "application/octet-stream"
	}
	sniffed, _, err := mime.ParseMediaType(http.DetectContentType(data))
	if err != nil {
		return "application/octet-stream"
	}
	return sniffed
}

// textTypes are the media types outside text/* whose bytes read as text.
var textTypes = []string{
	"application/json", "application/xml", "application/javascript",
	"application/x-yaml", "application/yaml", "application/toml", "image/svg+xml",
}

func isText(mediaType string) bool {
	return strings.HasPrefix(mediaType, "text/") || slices.Contains(textTypes, mediaType)
}

func readAtMost(path string, limit int64) ([]byte, error) {
	file, err := os.Open(path) //nolint:gosec // a file the session's own agent named, read as the same user it runs as
	if err != nil {
		return nil, err
	}
	defer func() { _ = file.Close() }()
	return io.ReadAll(io.LimitReader(file, limit+1))
}

func sharedID() (string, error) {
	var raw [8]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw[:]), nil
}

// clip cuts s to at most max bytes, on a rune boundary.
func clip(s string, max int) string {
	if len(s) <= max {
		return s
	}
	for max > 0 && !utf8.RuneStart(s[max]) {
		max--
	}
	return s[:max]
}

// sharedEntries is every entry saved under dir that seen does not hold, in
// the order they were shared, with the file name of each.
func sharedEntries(dir string, seen map[string]bool) (entries, names []string) {
	items, err := os.ReadDir(dir)
	if err != nil {
		return nil, nil
	}
	for _, item := range items {
		name := item.Name()
		if seen[name] || !strings.HasSuffix(name, ".json") || strings.HasPrefix(name, ".") {
			continue
		}
		raw, err := os.ReadFile(filepath.Join(dir, name)) //nolint:gosec // a name in the runner's own folder
		if err != nil || len(raw) > SharedEntryMax || !json.Valid(raw) {
			continue
		}
		entries, names = append(entries, string(raw)), append(names, name)
	}
	return entries, names
}

// SharedDir is where a session's shared entries are kept under filesDir.
func SharedDir(filesDir, sessionID string) string {
	return filepath.Join(filesDir, sessionID, sharedDir)
}
