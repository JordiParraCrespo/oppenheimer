package transcript

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

// screenshot is a PNG of w×h with noise in it, so it does not compress to
// nothing, as base64.
func screenshot(t *testing.T, w, h int) string {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	seed := uint32(7)
	for y := range h {
		for x := range w {
			seed = seed*1664525 + 1013904223
			img.Set(x, y, color.RGBA{uint8(seed >> 24), uint8(x), uint8(y), 0xff})
		}
	}
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		t.Fatal(err)
	}
	return base64.StdEncoding.EncodeToString(out.Bytes())
}

func decodePreview(t *testing.T, source map[string]any) image.Config {
	t.Helper()
	if source["type"] != "base64" || source["media_type"] != "image/jpeg" {
		t.Fatalf("source: %v", source)
	}
	data, err := base64.StdEncoding.DecodeString(source["data"].(string))
	if err != nil {
		t.Fatal(err)
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		t.Fatalf("the preview is not a JPEG: %v", err)
	}
	return config
}

// A screenshot the agent read, and one the person pasted, reach the chat as
// pictures: each a JPEG preview, the entry still under the link's bound.
func TestImagesReachTheChatAsPreviewsUnderTheEntryBound(t *testing.T) {
	const max = 64 << 10
	shot := screenshot(t, 1400, 900)
	lines := []string{
		`{"type":"user","uuid":"u","message":{"role":"user","content":[{"type":"text","text":"like this"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"` + shot + `"}}]}}`,
		`{"type":"user","uuid":"r","message":{"role":"user","content":[{"type":"tool_result","tool_use_id":"t1","content":[{"type":"image","source":{"type":"base64","media_type":"image/png","data":"` + shot + `"}},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"` + shot + `"}}]}]}}`,
	}
	var reader claudeReader
	var entries []map[string]any
	for _, line := range lines {
		encoded, ok := reader.chatEntry([]byte(line), max)
		if !ok {
			t.Fatalf("no entry for %.60s", line)
		}
		if len(encoded) > max {
			t.Fatalf("an entry of %d bytes, over %d", len(encoded), max)
		}
		var entry map[string]any
		if err := json.Unmarshal(encoded, &entry); err != nil {
			t.Fatal(err)
		}
		entries = append(entries, entry)
	}
	content := func(i int) []any { return entries[i]["message"].(map[string]any)["content"].([]any) }

	pasted := content(0)[1].(map[string]any)
	if config := decodePreview(t, pasted["source"].(map[string]any)); config.Width > 1400 || config.Width < 240 || config.Width*900 != config.Height*1400 && config.Width*900/1400-config.Height > 1 {
		t.Fatalf("pasted preview is %dx%d", config.Width, config.Height)
	}
	result := content(1)[0].(map[string]any)
	if result["content"] != "[image]\n[image]" {
		t.Fatalf("the result's text still names its images: %q", result["content"])
	}
	images := result["images"].([]any)
	if len(images) != 2 {
		t.Fatalf("images: %v", images)
	}
	for _, image := range images {
		decodePreview(t, image.(map[string]any)["source"].(map[string]any))
	}
}

// An image the bound leaves no room for, or one that is not a picture the
// host can read, is named and never sent.
func TestAnImageWithNoRoomIsNamedOnly(t *testing.T) {
	line := `{"type":"user","uuid":"u","message":{"role":"user","content":[{"type":"text","text":"look"},{"type":"image","source":{"type":"base64","media_type":"image/png","data":"` + screenshot(t, 400, 300) + `"}},{"type":"image","source":{"type":"base64","media_type":"image/webp","data":"UklGRg=="}}]}}`
	const max = 10 << 10
	encoded, ok := claudeReader{}.chatEntry([]byte(line), max)
	if !ok || len(encoded) > max {
		t.Fatalf("entry: %d bytes, %v", len(encoded), ok)
	}
	var entry struct {
		Message struct {
			Content []map[string]any `json:"content"`
		} `json:"message"`
	}
	if err := json.Unmarshal(encoded, &entry); err != nil {
		t.Fatal(err)
	}
	for _, block := range entry.Message.Content[1:] {
		if block["type"] != "image" || block["source"] != nil {
			t.Fatalf("image %v carries a source", block["type"])
		}
	}
}

func TestATransparentImageIsPreviewedOnWhite(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 40, 40))
	var out bytes.Buffer
	if err := png.Encode(&out, img); err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(map[string]string{"type": "base64", "media_type": "image/png", "data": base64.StdEncoding.EncodeToString(out.Bytes())})
	preview := previewImage(raw, 32<<10)
	if preview == nil {
		t.Fatal("no preview")
	}
	data, _ := base64.StdEncoding.DecodeString(preview.Data)
	decoded, err := jpeg.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if r, g, b, _ := decoded.At(20, 20).RGBA(); r>>8 < 250 || g>>8 < 250 || b>>8 < 250 {
		t.Fatalf("transparent read as %d,%d,%d, want white", r>>8, g>>8, b>>8)
	}
}
