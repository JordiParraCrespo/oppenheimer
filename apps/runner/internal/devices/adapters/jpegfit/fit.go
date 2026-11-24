// Package jpegfit shrinks a device's screen frames to the width a reader is
// shown them at. A simulator streams every frame at its full resolution (an
// iPhone's is 1206x2622, about 550 KB a frame), larger than the link carries
// and than the console's pane draws; a frame scaled to the pane is a fifth of
// that. The standard library decodes and encodes; the scaling is an area
// average over the image's own YCbCr planes, so no colour conversion runs.
package jpegfit

import (
	"bytes"
	"fmt"
	"image"
	"image/draw"
	"image/jpeg"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/devices/app"
)

// Quality is the JPEG quality frames are re-encoded at: a phone's screen is
// flat colour and text, which 70 keeps sharp at a fraction of the bytes.
const Quality = 70

// Fitter scales frames wider than Width down to it, keeping their shape.
type Fitter struct {
	// Width is the widest frame passed on, in pixels; 0 passes every frame
	// as it came.
	Width int
}

var _ app.Fitter = Fitter{}

// Fit is the frame at most Width wide. A frame that is already narrow
// enough is returned as it came, without decoding it.
func (f Fitter) Fit(frame []byte) ([]byte, error) {
	if f.Width <= 0 {
		return frame, nil
	}
	config, err := jpeg.DecodeConfig(bytes.NewReader(frame))
	if err != nil {
		return nil, fmt.Errorf("read the frame's size: %w", err)
	}
	if config.Width <= f.Width {
		return frame, nil
	}
	src, err := jpeg.Decode(bytes.NewReader(frame))
	if err != nil {
		return nil, fmt.Errorf("decode the frame: %w", err)
	}
	b := src.Bounds()
	width := f.Width
	height := max(1, (b.Dy()*width+b.Dx()/2)/b.Dx())
	var out bytes.Buffer
	out.Grow(len(frame) / 4)
	if err := jpeg.Encode(&out, shrink(src, width, height), &jpeg.Options{Quality: Quality}); err != nil {
		return nil, fmt.Errorf("encode the frame: %w", err)
	}
	return out.Bytes(), nil
}

// shrink is src at width x height, which are no larger than src.
func shrink(src image.Image, width, height int) image.Image {
	if ycc, ok := src.(*image.YCbCr); ok {
		return shrinkYCbCr(ycc, width, height)
	}
	if gray, ok := src.(*image.Gray); ok {
		dst := image.NewGray(image.Rect(0, 0, width, height))
		b := gray.Bounds()
		area(gray.Pix[gray.PixOffset(b.Min.X, b.Min.Y):], b.Dx(), b.Dy(), gray.Stride, 1, dst.Pix, width, height, dst.Stride)
		return dst
	}
	// Any other model (a CMYK JPEG) goes through RGBA first.
	b := src.Bounds()
	rgba := image.NewRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(rgba, rgba.Bounds(), src, b.Min, draw.Src)
	dst := image.NewRGBA(image.Rect(0, 0, width, height))
	area(rgba.Pix, b.Dx(), b.Dy(), rgba.Stride, 4, dst.Pix, width, height, dst.Stride)
	return dst
}

// shrinkYCbCr scales each plane on its own, keeping the subsampling.
func shrinkYCbCr(src *image.YCbCr, width, height int) *image.YCbCr {
	b := src.Bounds()
	dst := image.NewYCbCr(image.Rect(0, 0, width, height), src.SubsampleRatio)
	area(src.Y[src.YOffset(b.Min.X, b.Min.Y):], b.Dx(), b.Dy(), src.YStride, 1, dst.Y, width, height, dst.YStride)
	scw, sch := chroma(b.Dx(), b.Dy(), src.SubsampleRatio)
	dcw, dch := chroma(width, height, src.SubsampleRatio)
	from := src.COffset(b.Min.X, b.Min.Y)
	area(src.Cb[from:], scw, sch, src.CStride, 1, dst.Cb, dcw, dch, dst.CStride)
	area(src.Cr[from:], scw, sch, src.CStride, 1, dst.Cr, dcw, dch, dst.CStride)
	return dst
}

// chroma is the size of a chroma plane for an image of w x h.
func chroma(w, h int, ratio image.YCbCrSubsampleRatio) (int, int) {
	switch ratio {
	case image.YCbCrSubsampleRatio422:
		return (w + 1) / 2, h
	case image.YCbCrSubsampleRatio420:
		return (w + 1) / 2, (h + 1) / 2
	case image.YCbCrSubsampleRatio440:
		return w, (h + 1) / 2
	case image.YCbCrSubsampleRatio411:
		return (w + 3) / 4, h
	case image.YCbCrSubsampleRatio410:
		return (w + 3) / 4, (h + 1) / 2
	default:
		return w, h
	}
}

// area scales an interleaved 8-bit image of ch channels from sw x sh down to
// dw x dh: each output pixel is the mean of the source pixels it covers.
// Every source pixel is read once, so it costs what the source does.
func area(src []uint8, sw, sh, sstride, ch int, dst []uint8, dw, dh, dstride int) {
	// Where each output column and row starts in the source.
	xs := make([]int, dw+1)
	for x := range xs {
		xs[x] = x * sw / dw
	}
	// How many source columns each output column covers.
	spans := make([]int, dw)
	for x := range dw {
		xs[x+1] = max(xs[x+1], xs[x]+1)
		spans[x] = xs[x+1] - xs[x]
	}
	sums := make([]int, dw*ch)
	for y := range dh {
		top := y * sh / dh
		bottom := max((y+1)*sh/dh, top+1)
		clear(sums)
		for sy := top; sy < bottom; sy++ {
			row := src[sy*sstride:]
			if ch == 1 {
				for x := range dw {
					var sum int
					for _, v := range row[xs[x]:xs[x+1]] {
						sum += int(v)
					}
					sums[x] += sum
				}
				continue
			}
			for x := range dw {
				for sx := xs[x]; sx < xs[x+1]; sx++ {
					for c := range ch {
						sums[x*ch+c] += int(row[sx*ch+c])
					}
				}
			}
		}
		out := dst[y*dstride:]
		rows := bottom - top
		for x := range dw {
			n := spans[x] * rows
			for c := range ch {
				out[x*ch+c] = uint8((sums[x*ch+c] + n/2) / n) //nolint:gosec // the mean of n bytes is a byte
			}
		}
	}
}
