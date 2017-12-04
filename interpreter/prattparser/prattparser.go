package prattparser

import "fmt"

// A PrattParser holds rules for parsing source string
type PrattParser struct {
	tokenizer   *Tokenizer
	precedence  map[string]int
	prefixRules map[string]PrefixRule
	infixRules  map[string]InfixRule
}

// A PrefixRule handles grammar rules that starts with a token
type PrefixRule func(token Token, ctx *Context) (interface{}, error)

// An InfixRule handles grammar rules that starts with an expression
type InfixRule func(left interface{}, token Token, ctx *Context) (interface{}, error)

// New creates a PrattParser from a language definition
func New(
	ignore string, tokens []string, patterns map[string]string,
	precedence [][]string, prefixRules map[string]PrefixRule, infixRules map[string]InfixRule) *PrattParser {

	// Create a precedence map
	prec := make(map[string]int)
	for i, row := range precedence {
		for _, kind := range row {
			prec[kind] = i + 1
		}
	}

	// Ensure we have precedence for all the kinds used in infixRules
	for kind := range infixRules {
		if _, ok := prec[kind]; !ok {
			panic(fmt.Sprintf("token '%s' must have a precedence", kind))
		}
	}

	return &PrattParser{
		tokenizer:   NewTokenizer(ignore, tokens, patterns),
		precedence:  prec,
		prefixRules: prefixRules,
		infixRules:  infixRules,
	}
}

// Parse source string from offset passing context through Context
func (p *PrattParser) Parse(source string, offset int, context interface{}) (interface{}, error) {
	ctx := newContext(p, source, offset, context)
	value, err := ctx.Parse("")
	if err != nil {
		return nil, err
	}
	next, err := ctx.Attempt()
	if err != nil {
		return nil, err
	}
	if !next.IsEmpty() {
		return nil, SyntaxError{
			Message: "expected end of input",
			Source:  source,
			Start:   next.Start,
			End:     next.End,
		}
	}
	return value, nil
}

// ParseUntil terminator is encountered, and return offset where expression ended
func (p *PrattParser) ParseUntil(source string, offset int, terminator string, context interface{}) (interface{}, int, error) {
	ctx := newContext(p, source, offset, context)
	value, err := ctx.Parse("")
	if err != nil {
		return nil, 0, err
	}
	next, err := ctx.Attempt()
	if err != nil {
		return nil, 0, err
	}
	if next.Kind != terminator {
		return nil, 0, SyntaxError{
			Source:   source,
			Start:    next.Start,
			End:      next.End,
			Expected: []string{terminator},
		}
	}
	return value, next.End, nil
}

// Context passed to rules by the PrattParser
type Context struct {
	parser  *PrattParser
	source  string
	offset  int
	context interface{}
	next    Token
	err     error
}

func newContext(parser *PrattParser, source string, offset int, context interface{}) *Context {
	next, err := parser.tokenizer.Next(source, offset)
	return &Context{
		parser:  parser,
		source:  source,
		offset:  offset,
		context: context,
		next:    next,
		err:     err,
	}
}

// Source being parsed
func (c *Context) Source() string {
	return c.source
}

// Context passed to Parse function
func (c *Context) Context() interface{} {
	return c.context
}

// Attempt to get the next token, if it matches one of the kinds given,
// otherwise return Token{}. If no kinds are given returns the next token of
// any kind.
func (c *Context) Attempt(kinds ...string) (Token, error) {
	if c.err != nil {
		return Token{}, c.err
	}
	if c.next.IsEmpty() {
		return Token{}, nil
	}
	if len(kinds) > 0 && !stringsContains(c.next.Kind, kinds) {
		return Token{}, nil
	}
	current := c.next
	c.next, c.err = c.parser.tokenizer.Next(c.source, c.next.End)
	return current, nil
}

// Require the next token, returns an error if it doesn't match one of the
// given kinds or end of input. If not kinds are given returns the next token
// of any kind or error if end of input.
func (c *Context) Require(kinds ...string) (Token, error) {
	token, err := c.Attempt()
	if err != nil {
		return Token{}, err
	}
	if token.IsEmpty() {
		return Token{}, SyntaxError{
			Message: "unexpected end of input",
			Source:  c.source,
			Start:   len(c.source) - 1,
			End:     len(c.source),
		}
	}
	if len(kinds) > 0 && !stringsContains(token.Kind, kinds) {
		return Token{}, SyntaxError{
			Message:  fmt.Sprintf("unexpected '%s'", token.Value),
			Source:   c.source,
			Start:    token.Start,
			End:      token.End,
			Expected: kinds,
		}
	}
	return token, nil
}

func (c *Context) prefixKinds() []string {
	var kinds []string
	for kind := range c.parser.prefixRules {
		kinds = append(kinds, kind)
	}
	return kinds
}

// Parse expression with indicated precedence
func (c *Context) Parse(precedence string) (interface{}, error) {
	prec := c.parser.precedence[precedence]
	token, err := c.Require()
	if err != nil {
		return nil, err
	}
	prefixRule := c.parser.prefixRules[token.Kind]
	if prefixRule == nil {
		return nil, SyntaxError{
			Message:  fmt.Sprintf("unexpected '%s'", token.Value),
			Source:   c.source,
			Start:    token.Start,
			End:      token.End,
			Expected: c.prefixKinds(),
		}
	}
	value, err := prefixRule(token, c)
	if err != nil {
		return nil, err
	}
	for !c.next.IsEmpty() && c.parser.infixRules[c.next.Kind] != nil && prec < c.parser.precedence[c.next.Kind] {
		token, err := c.Require()
		if err != nil {
			return nil, err
		}
		value, err = c.parser.infixRules[token.Kind](value, token, c)
		if err != nil {
			return nil, err
		}
	}
	return value, nil
}
