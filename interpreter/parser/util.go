package parser

import (
	"fmt"
	"regexp"
)

func mustBeNonCaptureRegex(r string) {
	if regexp.MustCompile(r).NumSubexp() > 0 {
		panic(fmt.Sprintf("regular expression '%s' should be non-capturing", r))
	}
}

func StringsContains(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}
