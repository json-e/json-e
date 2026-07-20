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
	Location []string
}

func (s SyntaxError) Error() string {
	var message string
	if s.Expected != nil {
		message = fmt.Sprintf("Found: %s token, expected one of: %s",
			s.sourceAtError(), strings.Join(s.Expected, ", "))
	} else if s.Message == "" {
		message = fmt.Sprintf("Unexpected input for '%s' at '%s'", s.Source, s.sourceAtError())
	} else if s.Message == "unexpected end of input" {
		message = "Unexpected end of input"
	} else {
		message = s.Message
	}

	location := ""
	if len(s.Location) > 0 {
		location = " at template" + strings.Join(s.Location, "")
	}
	return fmt.Sprintf("SyntaxError%s: %s", location, message)
}

// AddLocation prepends a location to the error.
func (s SyntaxError) AddLocation(location string) error {
	s.Location = append([]string{location}, s.Location...)
	return s
}

func (s SyntaxError) sourceAtError() string {
	if s.Start < 0 || s.Start > len(s.Source) || s.End < s.Start || s.End > len(s.Source) {
		return ""
	}
	return s.Source[s.Start:s.End]
}
