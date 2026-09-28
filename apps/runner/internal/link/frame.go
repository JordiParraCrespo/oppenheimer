package link

import "encoding/binary"

// The frame layout is FrameHeader bytes of big-endian attachment id, then the
// PTY bytes; FrameHeader is generated (protocol.gen.go).

// EncodeFrame prefixes PTY bytes with their attachment id.
func EncodeFrame(attachmentID uint32, bytes []byte) []byte {
	frame := make([]byte, FrameHeader+len(bytes))
	binary.BigEndian.PutUint32(frame, attachmentID)
	copy(frame[FrameHeader:], bytes)
	return frame
}

// DecodeFrame splits a binary frame. ok is false for a frame too short to
// carry a header, which is dropped rather than guessed at.
func DecodeFrame(frame []byte) (attachmentID uint32, bytes []byte, ok bool) {
	if len(frame) < FrameHeader {
		return 0, nil, false
	}
	return binary.BigEndian.Uint32(frame), frame[FrameHeader:], true
}
