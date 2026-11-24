package domain

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png" // WhatsApp sends the odd PNG as an image message
)

// ImageMaxBytes is the largest image handed to the control plane
// (`WHATSAPP_IMAGE_MAX_BYTES`): one link frame, base64 and all, as a voice
// note is. A larger one is scaled down (FitImage) rather than refused.
const ImageMaxBytes = 352 * 1024

// ImageDownloadMaxBytes bounds what is downloaded from WhatsApp to be
// scaled: an HD photo is a few megabytes, and anything past this is held in
// memory for nothing.
const ImageDownloadMaxBytes = 16 * 1024 * 1024

// ImageMimetype is what a scaled image is sent as.
const ImageMimetype = "image/jpeg"

// imageLongestSide is the longest side a scaled image starts at: past it a
// model sees no more, and a photo of it fits a frame at a good quality.
const imageLongestSide = 1600

// imageQuality is the JPEG quality a scaled image is written at.
const imageQuality = 82

// ImageMaxPixels bounds the image decoded to be scaled, read off its header
// before any pixel is: a WhatsApp HD photo is about 16 megapixels, and a
// sender can make a small file that claims far more (a PNG of one colour
// compresses a thousandfold), which decoded would take gigabytes.
const ImageMaxPixels = 40_000_000

// Image is what fetching an image later takes: the adapter's own reference
// to it (opaque here) and how large WhatsApp says it is.
type Image struct {
	Ref  []byte
	Size uint64
}

// TooLarge reports whether the image is past what is downloaded at all.
func (i Image) TooLarge() bool { return i.Size > ImageDownloadMaxBytes }

// ErrImageUnreadable is an image too large for a frame that cannot be
// decoded to be scaled.
var ErrImageUnreadable = errors.New("the image is neither a JPEG nor a PNG that can be scaled")

// ErrImageTooManyPixels is an image whose header claims more than
// ImageMaxPixels: refused before it is decoded.
var ErrImageTooManyPixels = errors.New("the image has too many pixels to scale")

// FitImage is data as it can travel in one frame: as it is when it fits
// max, else decoded and written again as a JPEG, smaller each try, until it
// does. The mimetype is the one data had when it fit, ImageMimetype otherwise.
func FitImage(data []byte, mimetype string, max int) ([]byte, string, error) {
	if len(data) <= max {
		return data, mimetype, nil
	}
	header, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return nil, "", ErrImageUnreadable
	}
	if header.Width <= 0 || header.Height <= 0 || header.Width > ImageMaxPixels/header.Height {
		return nil, "", ErrImageTooManyPixels
	}
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", ErrImageUnreadable
	}
	side := imageLongestSide
	for range 6 {
		// Each try scales the last, so the source's pixels are walked once.
		src = scaleToFit(src, side)
		var out bytes.Buffer
		if err := jpeg.Encode(&out, src, &jpeg.Options{Quality: imageQuality}); err != nil {
			return nil, "", err
		}
		if out.Len() <= max {
			return out.Bytes(), ImageMimetype, nil
		}
		side = side * 3 / 4
	}
	return nil, "", errors.New("the image does not fit one frame even scaled down")
}

// scaleToFit is src with its longest side at most side, each pixel the
// average of the source pixels it covers (a box filter: plain, and sharp
// enough for a model to read a screenshot's text), laid on white, since a
// JPEG has no transparency and a transparent PNG would turn black. A src
// already within side keeps its size.
func scaleToFit(src image.Image, side int) image.Image {
	b := src.Bounds()
	w, h := b.Dx(), b.Dy()
	nw, nh := side, side
	switch {
	case w <= side && h <= side:
		// No smaller, but still laid on white: a pass at its own size.
		nw, nh = w, h
	case w >= h:
		nh = max(1, h*side/w)
	default:
		nw = max(1, w*side/h)
	}
	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	for y := range nh {
		y0, y1 := b.Min.Y+y*h/nh, b.Min.Y+max((y+1)*h/nh, y*h/nh+1)
		for x := range nw {
			x0, x1 := b.Min.X+x*w/nw, b.Min.X+max((x+1)*w/nw, x*w/nw+1)
			var r, g, bl, n uint64
			for sy := y0; sy < y1; sy++ {
				for sx := x0; sx < x1; sx++ {
					cr, cg, cb, ca := src.At(sx, sy).RGBA()
					// Premultiplied, so white shows through as much as the pixel lets it.
					r, g, bl, n = r+uint64(cr+0xffff-ca), g+uint64(cg+0xffff-ca), bl+uint64(cb+0xffff-ca), n+1
				}
			}
			dst.Set(x, y, color.RGBA64{R: uint16(r / n), G: uint16(g / n), B: uint16(bl / n), A: 0xffff}) //nolint:gosec // an average of 16-bit values
		}
	}
	return dst
}
