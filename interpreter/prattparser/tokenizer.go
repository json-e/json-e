package prattparser

import (
	"fmt"
	"regexp"
	"strings"
)

// A Token as returend by Tokenizer
type Token struct {
	Kind  string
	Value string
	Start int
	End   int
}

// IsEmpty returns true, if the token is empty. Often used to communicate
// no token is available, such as end of input.
func (t *Token) IsEmpty() bool {
	return t.Kind == "" && t.Value == "" && t.Start == 0 && t.End == 0
}

// A Tokenizer holds rules to tokenize a source string.
type Tokenizer struct {
	kinds     []string
	hasIgnore bool
	regex     *regexp.Regexp
}

// NewTokenizer creates a tokenizer from a language definition
func NewTokenizer(ignore string, tokens []string, patterns map[string]string) *Tokenizer {
	// Simple input validation
	mustBeNonCaptureRegex(ignore)
	for kind, pattern := range patterns {
		if !StringsContains(kind, tokens) {
			panic(fmt.Sprintf("kind '%s' listed in patterns, but not in tokens", kind))
		}
		mustBeNonCaptureRegex(pattern)
	}

	// Consturct options for regular expression
	var options []string
	if ignore != "" {
		options = append(options, fmt.Sprintf(`(%s)`, ignore))
	}
	for _, kind := range tokens {
		pattern, ok := patterns[kind]
		if !ok {
			pattern = regexp.QuoteMeta(kind)
		}
		options = append(options, fmt.Sprintf(`(%s)`, pattern))
	}

	// Construct tokenizer
	return &Tokenizer{
		kinds:     tokens,
		hasIgnore: ignore != "",
		regex:     regexp.MustCompile(fmt.Sprintf(`^(?:%s)`, strings.Join(options, `|`))),
	}
}

// Next returns the next token from source string as given offset
func (t *Tokenizer) Next(source string, offset int) (Token, error) {
	for {
		m := t.regex.FindStringSubmatch(source[offset:])
		if m == nil {
			if source[offset:] != "" {
				return Token{}, SyntaxError{
					Source: source,
					Start:  offset,
					End:    len(source),
				}
			}
			return Token{}, nil
		}
		var i int
		var text string
		for i, text = range m[1:] {
			if text != "" {
				break
			}
		}
		offset += len(text)
		if t.hasIgnore {
			i--
			if i == -1 {
				continue
			}
		}
		return Token{
			Kind:  t.kinds[i],
			Value: text,
			Start: offset - len(text),
			End:   offset,
		}, nil
	}
}

// Tokenize returns a list of tokens from a source string
func (t *Tokenizer) Tokenize(source string, offset int) ([]Token, error) {
	var tokens []Token
	for {
		token, err := t.Next(source, offset)
		if err != nil {
			return nil, err
		}
		if token.IsEmpty() {
			return tokens, nil
		}
		tokens = append(tokens, token)
		offset = token.End
	}
}
