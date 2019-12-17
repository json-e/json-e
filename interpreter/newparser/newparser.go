package newparser

import (
	"json-e/interpreter/prattparser"
	"strings"
)

type Parser struct {
	source       string
	tokenizer    prattparser.Tokenizer
	currentToken prattparser.Token
}

func (p *Parser) NewParser(source string, tokenizer prattparser.Tokenizer) {
	p.source = source
	p.tokenizer = tokenizer
	p.currentToken, _ = p.tokenizer.Next(p.source, 0)
}

func (p *Parser) eat(tokeType string) {
	if p.currentToken.Kind == tokeType {
		p.currentToken, _ = p.tokenizer.Next(p.source, p.currentToken.End)
	}
}

func (p *Parser) Parse() (node ASTnodeIntr) {
	//    factor : (PLUS | MINUS) factor | Primitives
	token := p.currentToken
	var unaryNode UnaryOp
	var termNode ASTnode

	if token.Kind == "+" {
		p.eat("+")
		unaryNode.NewNode(token, p.Parse())
		node = unaryNode
	} else if token.Kind == "-" {
		p.eat("-")
		unaryNode.NewNode(token, p.Parse())
		node = unaryNode
	} else if token.Kind == "!" {
		p.eat("!")
		unaryNode.NewNode(token, p.Parse())
		node = unaryNode
	} else if token.Kind == "number" {
		p.eat("number")
		termNode.NewNode(token)
		node = termNode
	}

	return
}

func CreateTokenizer() (tokenizer prattparser.Tokenizer) {
	tokenizer = *prattparser.NewTokenizer(`\s+`, strings.Split(
		`** + - * / [ ] . ( ) { } : , >= <= < > == != ! && || true false in null number identifier string`, " ",
	), map[string]string{
		"number":     `[0-9]+(?:\.[0-9]+)?`,
		"identifier": `[a-zA-Z_][a-zA-Z_0-9]*`,
		"string":     `'[^']*'|"[^"]*"`,
		"true":       `true\b`,
		"false":      `false\b`,
		"in":         `in\b`,
		"null":       `null\b`,
	})
	return
}
