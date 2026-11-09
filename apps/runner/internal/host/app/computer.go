package app

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"time"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/host/domain"
)

// ComputerPolicy is whether the host lets bots use its screen, as enforced.
func (s *Service) ComputerPolicy() (domain.ComputerPolicy, error) {
	if s.computers == nil {
		return domain.ComputerPolicy{}, nil
	}
	policy, err := s.computers.Load()
	if err != nil {
		return domain.ComputerPolicy{}, domain.ErrComputerPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return policy, nil
}

// SetComputerPolicy saves it, for `runner computer`.
func (s *Service) SetComputerPolicy(policy domain.ComputerPolicy) error {
	if s.computers == nil {
		return domain.ErrComputerPolicyFile.WithDetail("this runner keeps no computer setting")
	}
	if err := s.computers.Save(policy); err != nil {
		return domain.ErrComputerPolicyFile.WithDetail("%v", err).WithCause(err)
	}
	return nil
}

// ComputerScreen is the screen bots would use, for `runner computer`: its
// size, or why there is none.
func (s *Service) ComputerScreen(ctx context.Context) (domain.Screen, error) {
	if s.desktop == nil {
		return domain.Screen{}, domain.ErrComputerNoScreen.WithDetail("the runner drives no screen on this platform")
	}
	screen, err := s.desktop.Screen(ctx)
	if err != nil {
		return domain.Screen{}, desktopProblem(err)
	}
	return screen, nil
}

// Computer does one action on the host's screen for a bot and answers with
// what the screen shows after it (`computer.act`, 25 §4.2). The setting is
// read from disk on every call, so `runner computer off` stops the next
// action without a restart, and it is checked before the screen is touched:
// a host that is off says nothing about what it has.
func (s *Service) Computer(ctx context.Context, req domain.ComputerRequest) (domain.Screenshot, error) {
	policy, err := s.ComputerPolicy()
	if err != nil {
		return domain.Screenshot{}, err
	}
	if !policy.Enabled {
		return domain.Screenshot{}, domain.ErrComputerOff.WithDetail(
			"the person on this host can turn it on with `runner computer on`")
	}
	if s.desktop == nil {
		return domain.Screenshot{}, domain.ErrComputerNoScreen.WithDetail("the runner drives no screen on this platform")
	}

	select {
	case s.desktopTurn <- struct{}{}:
		defer func() { <-s.desktopTurn }()
	case <-ctx.Done():
		return domain.Screenshot{}, ctx.Err()
	}

	screen, err := s.desktop.Screen(ctx)
	if err != nil {
		return domain.Screenshot{}, desktopProblem(err)
	}
	width, height := domain.FitScreen(screen.Width, screen.Height, req.MaxEdge)
	if err := req.Validate(width, height); err != nil {
		return domain.Screenshot{}, domain.ErrComputerAction.WithDetail("%v", err).WithCause(err)
	}

	switch req.Action {
	case domain.ComputerScreenshot:
	case domain.ComputerWait:
		if err := sleep(ctx, req.Wait); err != nil {
			return domain.Screenshot{}, err
		}
	default:
		if err := s.desktop.Act(ctx, req.ScaledTo(width, height, screen)); err != nil {
			return domain.Screenshot{}, desktopProblem(err)
		}
		if err := sleep(ctx, domain.ComputerSettle); err != nil {
			return domain.Screenshot{}, err
		}
	}

	shown, err := s.desktop.Capture(ctx)
	if err != nil {
		return domain.Screenshot{}, desktopProblem(err)
	}
	encoded, err := encodeScreen(shown, width, height, req.MaxBytes)
	if err != nil {
		return domain.Screenshot{}, domain.ErrComputerUnusable.WithDetail("%v", err).WithCause(err)
	}
	return domain.Screenshot{JPEG: encoded, Width: width, Height: height, Display: screen.Display}, nil
}

func desktopProblem(err error) error {
	if errors.Is(err, domain.ErrNoScreen) {
		return domain.ErrComputerNoScreen.WithDetail("%v", err).WithCause(err)
	}
	return domain.ErrComputerUnusable.WithDetail("%v", err).WithCause(err)
}

func sleep(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

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
