package parser

import (
	"fmt"
	"strings"
)

// SyntaxError holds a snippet of source that couldn't be handled.
type SyntaxError struct {
	Message  string
	Source   string
	Start    int
	End      int
	Expected []string
}

func (s SyntaxError) Error() string {
	m := s.Message
	if m == "" {
		m = "syntax error"
	}
	if s.Expected != nil {
		return fmt.Sprintf("%s expected %s at %d -> '%s' in '%s'",
			m, strings.Join(s.Expected, ", "), s.Start, s.Source[s.Start:s.End], s.Source,
		)
	}
	return fmt.Sprintf("%s at %d -> '%s' in '%s'",
		m, s.Start, s.Source[s.Start:s.End], s.Source)
}
