package logs

import "errors"

var (
	errInvalidSource   = errors.New("invalid log source")
	errFilterRequired  = errors.New("filter required for service logs")
	errInvalidFilter   = errors.New("invalid service filter")
)

func PublicError(err error) string {
	switch {
	case errors.Is(err, errInvalidSource):
		return "Invalid log source"
	case errors.Is(err, errFilterRequired):
		return "Service unit name required"
	case errors.Is(err, errInvalidFilter):
		return "Invalid service unit name"
	default:
		return "Could not read logs"
	}
}
