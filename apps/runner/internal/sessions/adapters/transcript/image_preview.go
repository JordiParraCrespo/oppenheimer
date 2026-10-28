package transcript

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/draw"
	"image/jpeg"
	"math"

	// The formats Claude Code keeps an image in that the standard library
	// reads; a WebP is named in the chat and not previewed.
	_ "image/gif"
	_ "image/png"
)

const (
	// previewOverhead is what an image's source costs in the entry beside its
	// data: the keys, the type and the media type.
	previewOverhead = 96
	// previewMinBytes is the least room an image is worth previewing in: less
	// draws a picture too small to read.
	previewMinBytes = 6 << 10
	// previewDecodeMax bounds the pixels an image may have to be decoded at
	// all, so one huge picture cannot take the host's memory.
	previewDecodeMax = 40_000_000
)

// previewSides are the longest sides a preview is tried at, largest first,
// and previewQualities the JPEG qualities at each.
var (
	previewSides     = []int{1600, 1280, 1024, 800, 640, 480, 360, 240}
	previewQualities = []int{78, 60}
)

// chatImageSource is an image as the chat sends it, in Claude's own shape:
// base64 bytes and their media type.
type chatImageSource struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

// previewImage is the image a transcript's source holds, as a JPEG whose
// base64 is at most budget bytes: the largest of previewSides (never larger
// than the image is) that fits, or none when the source is not an image the
// standard library reads or nothing fits. A screenshot the agent read stays
// whole on the host; the chat shows what the link has room for.
func previewImage(raw json.RawMessage, budget int) *chatImageSource {
	var source struct {
		Type string `json:"type"`
		Data string `json:"data"`
	}
	if json.Unmarshal(raw, &source) != nil || source.Type != "base64" || source.Data == "" {
		return nil
	}
	data, err := base64.StdEncoding.DecodeString(source.Data)
	if err != nil {
		return nil
	}
	config, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || config.Width <= 0 || config.Height <= 0 || config.Width*config.Height > previewDecodeMax {
		return nil
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil
	}
	limit := base64.StdEncoding.DecodedLen(budget)
	// Each size is scaled from the last, so a large picture is read whole
	// only once, and a size that missed says how far down the next must go:
	// a JPEG's bytes grow about with its area.
	scaled := onWhite(img)
	target := max(config.Width, config.Height)
	for _, side := range previewSides {
		if side > target && side != previewSides[0] {
			continue
		}
		scaled = scaleTo(scaled, side)
		got := 0
		for _, quality := range previewQualities {
			var out bytes.Buffer
			if jpeg.Encode(&out, scaled, &jpeg.Options{Quality: quality}) != nil {
				return nil
			}
			if out.Len() <= limit {
				return &chatImageSource{
					Type: "base64", MediaType: "image/jpeg",
					Data: base64.StdEncoding.EncodeToString(out.Bytes()),
				}
			}
			got = out.Len()
		}
		longest := max(scaled.Rect.Dx(), scaled.Rect.Dy())
		target = min(target, int(float64(longest)*math.Sqrt(float64(limit)/float64(got))))
	}
	return nil
}

// onWhite is img as RGBA pixels, laid over white where it was transparent,
// since a JPEG has no alpha.
func onWhite(img image.Image) *image.RGBA {
	bounds := img.Bounds()
	out := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(out, out.Bounds(), image.White, image.Point{}, draw.Src)
	draw.Draw(out, out.Bounds(), img, bounds.Min, draw.Over)
	return out
}

// scaleTo shrinks img so its longest side is side, each pixel the average of
// the ones it covers: a box filter, which keeps a screenshot's text legible
// where nearest-neighbour would drop strokes.
func scaleTo(img *image.RGBA, side int) *image.RGBA {
	w, h := img.Rect.Dx(), img.Rect.Dy()
	nw, nh := w, h
	if w >= h && w > side {
		nw, nh = side, max(1, h*side/w)
	} else if h > w && h > side {
		nw, nh = max(1, w*side/h), side
	}
	if nw == w && nh == h {
		return img
	}
	out := image.NewRGBA(image.Rect(0, 0, nw, nh))
	for y := range nh {
		y0, y1 := y*h/nh, max((y+1)*h/nh, y*h/nh+1)
		for x := range nw {
			x0, x1 := x*w/nw, max((x+1)*w/nw, x*w/nw+1)
			var r, g, b, n int
			for sy := y0; sy < y1; sy++ {
				row := img.Pix[sy*img.Stride:]
				for sx := x0; sx < x1; sx++ {
					r += int(row[sx*4])
					g += int(row[sx*4+1])
					b += int(row[sx*4+2])
					n++
				}
			}
			i := y*out.Stride + x*4
			out.Pix[i], out.Pix[i+1], out.Pix[i+2], out.Pix[i+3] = uint8(r/n), uint8(g/n), uint8(b/n), 0xff //nolint:gosec // an average of bytes is a byte
		}
	}
	return out
}
