package domain

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"math/rand/v2"
	"testing"
)

// noisyJPEG is a photo-like JPEG of w×h, noise so it compresses poorly, as a
// real HD photo does.
func noisyJPEG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	rng := rand.New(rand.NewPCG(1, 2)) //nolint:gosec // test pixels
	for y := range h {
		for x := range w {
			img.Set(x, y, color.RGBA{R: uint8(rng.IntN(256)), G: uint8(x), B: uint8(y), A: 0xff}) //nolint:gosec // test pixels
		}
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

// An image that fits a frame goes as WhatsApp gave it; a larger one comes
// back as a smaller JPEG under the cap, its sides in proportion, so an HD
// photo reaches a bot instead of being refused for its size. Breaks if the
// scaled image is sent past the frame (the link would close) or distorted.
func TestFitImage(t *testing.T) {
	small := []byte("tiny")
	got, mimetype, err := FitImage(small, "image/png", 1024)
	if err != nil || !bytes.Equal(got, small) || mimetype != "image/png" {
		t.Fatalf("a small image came back as %d bytes %q %v", len(got), mimetype, err)
	}

	big := noisyJPEG(t, 2400, 1200)
	if len(big) <= ImageMaxBytes {
		t.Fatalf("the test photo is only %d bytes", len(big))
	}
	got, mimetype, err = FitImage(big, "image/jpeg", ImageMaxBytes)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) > ImageMaxBytes || mimetype != ImageMimetype {
		t.Fatalf("scaled to %d bytes %q", len(got), mimetype)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(got))
	if err != nil {
		t.Fatal(err)
	}
	if b := decoded.Bounds(); b.Dx() != 2*b.Dy() || b.Dx() > imageLongestSide {
		t.Fatalf("scaled to %dx%d", b.Dx(), b.Dy())
	}

	if _, _, err := FitImage(bytes.Repeat([]byte{1}, 2048), "image/webp", 1024); err == nil {
		t.Fatal("an undecodable image past the cap was handed on")
	}
}

// A file whose header claims more than ImageMaxPixels is refused before it
// is decoded: a sender's one-colour PNG of 7000×7000 is a few kilobytes
// and would decode to tens of megabytes (at 30000×30000, gigabytes), which
// would take the host's runner down. Breaks if the size is read only after
// decoding.
func TestFitImageRefusesTooManyPixels(t *testing.T) {
	var bomb bytes.Buffer
	if err := png.Encode(&bomb, image.NewGray(image.Rect(0, 0, 7000, 7000))); err != nil {
		t.Fatal(err)
	}
	if _, _, err := FitImage(bomb.Bytes(), "image/png", 1024); err != ErrImageTooManyPixels { //nolint:errorlint // the sentinel itself
		t.Fatalf("a 49-megapixel image answered %v", err)
	}
}

// A transparent PNG is laid on white when scaled to a JPEG, which has no
// transparency: premultiplied black would make a logo on nothing a black
// square.
func TestScaleToFitLaysTransparencyOnWhite(t *testing.T) {
	clear := image.NewNRGBA(image.Rect(0, 0, 4, 4))
	got := scaleToFit(clear, 2)
	if r, g, b, _ := got.At(0, 0).RGBA(); r != 0xffff || g != 0xffff || b != 0xffff {
		t.Fatalf("a transparent pixel scaled to %x %x %x", r, g, b)
	}
}
