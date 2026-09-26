package main

import "runtime"

func osName() string   { return runtime.GOOS }
func archName() string { return runtime.GOARCH }
