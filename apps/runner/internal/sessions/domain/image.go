package domain

import "bytes"

// ImageExtension is the extension an image of mediaType is saved under, so
// the agent reading the pasted path recognises it as an image. The types are
// the ones an agent reads (01, `session.image`); anything else is not one.
func ImageExtension(mediaType string) (string, bool) {
	ext, ok := imageExtensions[mediaType]
	return ext, ok
}

var imageExtensions = map[string]string{
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// SniffImage names the image type data's first bytes declare, or "" when they
// declare none of the four. A browser's claimed type is a label; the magic
// bytes are what an agent's image reader will go by.
func SniffImage(data []byte) string {
	switch {
	case bytes.HasPrefix(data, []byte("\x89PNG\r\n\x1a\n")):
		return "image/png"
	case bytes.HasPrefix(data, []byte("\xff\xd8\xff")):
		return "image/jpeg"
	case bytes.HasPrefix(data, []byte("GIF87a")), bytes.HasPrefix(data, []byte("GIF89a")):
		return "image/gif"
	case len(data) >= 12 && bytes.Equal(data[:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")):
		return "image/webp"
	}
	return ""
}
