package domain

import (
	"bytes"
	"unicode/utf8"
)

// The table of what counts as a file a session takes is generated from the
// shared one (session_file.gen.go, from
// packages/shared/src/protocol/session-file.ts), so the runner and the
// control plane judge the same bytes the same way. What is here is only the
// code that reads it: binary types by their magic bytes, text by being text.

type signaturePart struct {
	Offset int
	Bytes  []byte
}

type fileType struct {
	MediaType  string
	Extension  string
	Signatures [][]signaturePart
}

type textType struct {
	MediaType string
	Extension string
}

// FileExtension is the extension a file of mediaType is saved under, so the
// agent reading the pasted path reads it as what it is.
func FileExtension(mediaType string) (string, bool) {
	for _, t := range fileTypes {
		if t.MediaType == mediaType {
			return t.Extension, true
		}
	}
	for _, t := range textTypes {
		if t.MediaType == mediaType {
			return t.Extension, true
		}
	}
	return "", false
}

// FileIs reports whether data is a file of mediaType: a binary type's magic
// bytes, or, for a text type, text a session takes (IsText).
func FileIs(data []byte, mediaType string) bool {
	for _, t := range textTypes {
		if t.MediaType == mediaType {
			return IsText(data)
		}
	}
	return sniffBinary(data) == mediaType && mediaType != ""
}

// sniffBinary names the binary type data's first bytes declare, or "".
func sniffBinary(data []byte) string {
	for _, t := range fileTypes {
		for _, signature := range t.Signatures {
			if matches(data, signature) {
				return t.MediaType
			}
		}
	}
	return ""
}

// IsText reports whether data is text a session takes. The rule's owner is
// isSessionText in packages/shared/src/protocol/session-file.ts; this reads
// the same generated constants, and session_file_vectors_gen_test.go holds
// it to the TypeScript verdict byte for byte. Everything here is on bytes,
// never decoded characters, as the TypeScript side is.
func IsText(data []byte) bool {
	if len(data) == 0 {
		return false
	}
	for _, b := range data {
		if (b < 0x20 && !bytes.Contains(textControlAllowed, []byte{b})) || b == 0x7f {
			return false
		}
	}
	if !utf8.Valid(data) {
		return false
	}
	opening := bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})
	opening = bytes.TrimLeft(opening, " \t\n\f\r")
	if len(opening) > textOpeningBytes {
		opening = opening[:textOpeningBytes]
	}
	lowered := make([]byte, len(opening))
	for i, b := range opening {
		if b >= 'A' && b <= 'Z' {
			b += 'a' - 'A'
		}
		lowered[i] = b
	}
	for _, refused := range textRefusedOpenings {
		if bytes.HasPrefix(lowered, []byte(refused)) {
			return false
		}
	}
	return true
}

func matches(data []byte, signature []signaturePart) bool {
	for _, part := range signature {
		end := part.Offset + len(part.Bytes)
		if end > len(data) || !bytes.Equal(data[part.Offset:end], part.Bytes) {
			return false
		}
	}
	return true
}
