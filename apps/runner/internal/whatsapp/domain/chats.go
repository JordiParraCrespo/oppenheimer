package domain

// ChatsBatchMax is how many chats one `whatsapp.chats` carries
// (`WHATSAPP_CHATS_BATCH_MAX`); a longer list goes in several frames.
const ChatsBatchMax = 500

// KnownChat is a chat the number can be reached in before any message: a
// group it is in, or a person among its contacts. Name is the group's subject
// or the contact's saved name; empty is unknown.
type KnownChat struct {
	ChatID string
	Kind   ChatKind
	Name   string
}

// ChatBatches splits the list into frames of at most ChatsBatchMax, in order.
func ChatBatches(chats []KnownChat) [][]KnownChat {
	var batches [][]KnownChat
	for start := 0; start < len(chats); start += ChatsBatchMax {
		end := min(start+ChatsBatchMax, len(chats))
		batches = append(batches, chats[start:end])
	}
	return batches
}
