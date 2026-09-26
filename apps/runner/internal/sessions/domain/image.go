package domain

import "bytes"

// The table of what counts as an image is generated from the shared one
// (session_image.gen.go, from packages/shared/src/protocol/session-image.ts),
// so the runner and the control plane judge the same bytes the same way.
// What is here is only the loop that reads it.

type imageSignaturePart struct {
	Offset int
	Bytes  []byte
}

type imageType struct {
	MediaType  string
	Extension  string
	Signatures [][]imageSignaturePart
}

// ImageExtension is the extension an image of mediaType is saved under, so
// the agent reading the pasted path recognises it as an image.
func ImageExtension(mediaType string) (string, bool) {
	for _, t := range imageTypes {
		if t.MediaType == mediaType {
			return t.Extension, true
		}
	}
	return "", false
}

// SniffImage names the type data's first bytes declare, or "" when they
// declare none of the table's.
func SniffImage(data []byte) string {
	for _, t := range imageTypes {
		for _, signature := range t.Signatures {
			if matches(data, signature) {
				return t.MediaType
			}
		}
	}
	return ""
}

func matches(data []byte, signature []imageSignaturePart) bool {
	for _, part := range signature {
		end := part.Offset + len(part.Bytes)
		if end > len(data) || !bytes.Equal(data[part.Offset:end], part.Bytes) {
			return false
		}
	}
	return true
}
