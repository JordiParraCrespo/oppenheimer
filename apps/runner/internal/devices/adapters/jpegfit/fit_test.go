package jpegfit

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"testing"
)

// phoneFrame is a JPEG the size a simulator streams an iPhone 17 Pro at,
// with flat bands of colour and fine detail the way a screen has both.
func phoneFrame(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			c := color.RGBA{R: 30, G: 120, B: 220, A: 255} // the top half is blue
			if y >= h/2 {
				c = color.RGBA{R: 240, G: 240, B: 240, A: 255}
				if (x/3+y/3)%2 == 0 { // "text": a fine checker on white
					c = color.RGBA{R: 20, G: 20, B: 20, A: 255}
				}
			}
			img.Set(x, y, c)
		}
	}
	var out bytes.Buffer
	if err := jpeg.Encode(&out, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

// A full-resolution frame is larger than the link carries; fitted, it is the
// width asked, the device's shape, a fraction of the bytes, and the same
// picture.
func TestFitScalesAFullFrameToTheWidth(t *testing.T) {
	frame := phoneFrame(t, 1206, 2622)
	fitted, err := Fitter{Width: 720}.Fit(frame)
	if err != nil {
		t.Fatal(err)
	}
	img, err := jpeg.Decode(bytes.NewReader(fitted))
	if err != nil {
		t.Fatalf("the fitted frame is not a JPEG: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 720 || b.Dy() != 1565 {
		t.Fatalf("fitted to %v, want 720x1565 (the device's shape)", b.Size())
	}
	if len(fitted) >= len(frame)/2 {
		t.Fatalf("fitted %d bytes from %d: not smaller enough to matter", len(fitted), len(frame))
	}
	r, g, b, _ := img.At(360, 300).RGBA()
	if far(r>>8, 30) || far(g>>8, 120) || far(b>>8, 220) {
		t.Fatalf("the blue half came out as %d,%d,%d", r>>8, g>>8, b>>8)
	}
}

func far(got uint32, want int) bool { return int(got) < want-12 || int(got) > want+12 }

// A frame already narrow enough goes out byte for byte, never decoded.
func TestFitKeepsANarrowFrameAsItCame(t *testing.T) {
	frame := phoneFrame(t, 400, 860)
	fitted, err := Fitter{Width: 720}.Fit(frame)
	if err != nil || !bytes.Equal(fitted, frame) {
		t.Fatalf("a narrow frame was changed (err %v)", err)
	}
	fitted, err = Fitter{}.Fit(frame)
	if err != nil || !bytes.Equal(fitted, frame) {
		t.Fatalf("width 0 changed a frame (err %v)", err)
	}
}

// A grayscale JPEG has no chroma planes, and still scales.
func TestFitScalesAGrayFrame(t *testing.T) {
	img := image.NewGray(image.Rect(0, 0, 1000, 500))
	for i := range img.Pix {
		img.Pix[i] = 128
	}
	var frame bytes.Buffer
	if err := jpeg.Encode(&frame, img, nil); err != nil {
		t.Fatal(err)
	}
	fitted, err := Fitter{Width: 300}.Fit(frame.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	out, err := jpeg.Decode(bytes.NewReader(fitted))
	if err != nil || out.Bounds().Dx() != 300 || out.Bounds().Dy() != 150 {
		t.Fatalf("got %v, err %v", out.Bounds(), err)
	}
}

func TestFitRefusesWhatIsNotAJPEG(t *testing.T) {
	if _, err := (Fitter{Width: 720}).Fit([]byte("not a frame")); err == nil {
		t.Fatal("a broken frame was passed on as fitted")
	}
}

// The scaler's cost on a real frame size, to keep it well under a frame's
// interval at 30 fps.
func BenchmarkFitPhoneFrame(b *testing.B) {
	t := &testing.T{}
	frame := phoneFrame(t, 1206, 2622)
	b.ResetTimer()
	for range b.N {
		if _, err := (Fitter{Width: 720}).Fit(frame); err != nil {
			b.Fatal(err)
		}
	}
}
