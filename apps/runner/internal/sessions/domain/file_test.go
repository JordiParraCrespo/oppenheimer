package domain_test

import (
	"testing"

	"github.com/jordiparracrespo/oppenheimer/apps/runner/internal/sessions/domain"
)

// The runner holds a pulled file to the type it was parked under, by its
// bytes: the same judgement the control plane made, from the generated table.
func TestFileIsReadsTheBytesNotTheLabel(t *testing.T) {
	cases := []struct {
		data, mediaType string
		want            bool
	}{
		{"\x89PNG\r\n\x1a\nrest", "image/png", true},
		{"\xff\xd8\xff\xe0rest", "image/jpeg", true},
		{"GIF89arest", "image/gif", true},
		{"GIF87arest", "image/gif", true},
		{"RIFF\x00\x00\x00\x00WEBPVP8 ", "image/webp", true},
		{"%PDF-1.7\n\xe2\xe3\xcf\xd3", "application/pdf", true},
		{"# Notes\n\nCaf\xc3\xa9 \xe2\x9c\x93\r\n\tindented\f", "text/markdown", true},
		{"a,b\n1,2", "text/csv", true},
		{"{\"a\":1}", "application/json", true},
		{"\xef\xbb\xbfplain", "text/plain", true},
		// A label never makes bytes another type.
		{"%PDF-1.4", "image/png", false},
		{"\x89PNG\r\n\x1a\n", "text/plain", false},
		{"RIFF\x00\x00\x00\x00WAVE", "image/webp", false},
		{"", "text/plain", false},
		// Executables and archives are no type a session takes.
		{"\x7fELF\x02\x01\x01\x00", "text/plain", false},
		{"\xcf\xfa\xed\xfe\x07\x00\x00\x01", "text/plain", false},
		{"MZ\x90\x00\x03\x00", "text/plain", false},
		{"PK\x03\x04\x14\x00", "text/plain", false},
		{"\x1f\x8b\x08\x00", "text/plain", false},
		// Text a program runs: an interpreter line, markup, after a BOM or
		// whitespace, in any case.
		{"#!/bin/sh\nrm -rf ~\n", "text/plain", false},
		{"\xef\xbb\xbf  \n<!DOCTYPE html><p>", "text/plain", false},
		{"<HTML><script>", "text/plain", false},
		{"<svg xmlns=\"http://www.w3.org/2000/svg\"/>", "text/plain", false},
		{"<?xml version=\"1.0\"?><svg/>", "text/plain", false},
		// Not UTF-8, or control bytes.
		{"caf\xe9", "text/plain", false},
		{"\xc0\xaf", "text/plain", false},
		{"\xed\xa0\x80", "text/plain", false},
		{"a\x00b", "text/plain", false},
		{"a\x1b[31m", "text/plain", false},
		// A type nobody listed.
		{"plain words", "application/x-sh", false},
	}
	for _, c := range cases {
		if got := domain.FileIs([]byte(c.data), c.mediaType); got != c.want {
			t.Errorf("FileIs(%q, %q) = %v, want %v", c.data, c.mediaType, got, c.want)
		}
	}
}

func TestFileExtensionNamesEveryTypeAndNothingElse(t *testing.T) {
	want := map[string]string{
		"image/jpeg":       ".jpg",
		"application/pdf":  ".pdf",
		"text/plain":       ".txt",
		"text/markdown":    ".md",
		"text/csv":         ".csv",
		"application/json": ".json",
	}
	for mediaType, ext := range want {
		if got, ok := domain.FileExtension(mediaType); !ok || got != ext {
			t.Errorf("FileExtension(%q) = %q %v, want %q", mediaType, got, ok, ext)
		}
	}
	for _, refused := range []string{"image/svg+xml", "text/html", "application/zip", "application/x-sh"} {
		if _, ok := domain.FileExtension(refused); ok {
			t.Errorf("%s is not a type a session takes", refused)
		}
	}
}
