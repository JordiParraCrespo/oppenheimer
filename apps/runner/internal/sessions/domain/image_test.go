package domain_test

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

func TestSniffImageReadsTheMagicBytes(t *testing.T) {
	cases := map[string]string{
		"\x89PNG\r\n\x1a\nrest":        "image/png",
		"\xff\xd8\xff\xe0rest":         "image/jpeg",
		"GIF89arest":                   "image/gif",
		"GIF87arest":                   "image/gif",
		"RIFF\x00\x00\x00\x00WEBPVP8 ": "image/webp",
		"<svg xmlns=...":               "",
		"RIFF\x00\x00\x00\x00WAVE":     "",
		"":                             "",
	}
	for data, want := range cases {
		if got := domain.SniffImage([]byte(data)); got != want {
			t.Fatalf("SniffImage(%q) = %q, want %q", data, got, want)
		}
	}
}

func TestImageExtensionKnowsOnlyTheTypesAnAgentReads(t *testing.T) {
	if ext, ok := domain.ImageExtension("image/jpeg"); !ok || ext != ".jpg" {
		t.Fatalf("jpeg = %q %v", ext, ok)
	}
	if _, ok := domain.ImageExtension("image/svg+xml"); ok {
		t.Fatal("svg is not an image an agent reads")
	}
}
