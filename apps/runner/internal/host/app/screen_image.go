package app

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
)

// jpegQualities are tried in order until the image fits: text on a screen
// stays readable well below the first.
var jpegQualities = []int{80, 65, 50, 35, 20}

// encodeScreen is shown as a JPEG of width by height pixels, at most
// maxBytes: the best quality that fits.
func encodeScreen(shown image.Image, width, height, maxBytes int) ([]byte, error) {
	fitted := resize(shown, width, height)
	var out bytes.Buffer
	for _, quality := range jpegQualities {
		out.Reset()
		if err := jpeg.Encode(&out, fitted, &jpeg.Options{Quality: quality}); err != nil {
			return nil, err
		}
		if maxBytes <= 0 || out.Len() <= maxBytes {
			return out.Bytes(), nil
		}
	}
	return nil, errors.New("the screen does not fit the largest image a bot is sent")
}

// resize draws src at width by height, each pixel the average of the source
// pixels it covers: a Retina capture halved this way keeps small text
// readable, where picking every other pixel would not.
func resize(src image.Image, width, height int) image.Image {
	bounds := src.Bounds()
	if bounds.Dx() == width && bounds.Dy() == height {
		return src
	}
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := range height {
		y0 := bounds.Min.Y + y*bounds.Dy()/height
		y1 := max(y0+1, bounds.Min.Y+(y+1)*bounds.Dy()/height)
		for x := range width {
			x0 := bounds.Min.X + x*bounds.Dx()/width
			x1 := max(x0+1, bounds.Min.X+(x+1)*bounds.Dx()/width)
			var r, g, b, n uint32
			for sy := y0; sy < y1 && sy < bounds.Max.Y; sy++ {
				for sx := x0; sx < x1 && sx < bounds.Max.X; sx++ {
					pr, pg, pb, _ := src.At(sx, sy).RGBA()
					r, g, b, n = r+pr>>8, g+pg>>8, b+pb>>8, n+1
				}
			}
			if n > 0 {
				dst.SetRGBA(x, y, color.RGBA{R: uint8(r / n), G: uint8(g / n), B: uint8(b / n), A: 0xff}) //nolint:gosec // each is an average of bytes
			}
		}
	}
	return dst
}
