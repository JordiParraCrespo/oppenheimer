//go:build !darwin && !linux

package binaries

import "errors"

func swap(string, string) error { return errors.New("binaries: no atomic swap on this platform") }
