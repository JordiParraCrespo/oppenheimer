package link

// SetReporterLimit lowers a reporter's cap on pending batches, so a test need
// not make thousands.
func SetReporterLimit(r *Reporter, limit int) { r.limit = limit }
