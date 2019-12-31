package newparser

import (
	"json-e/interpreter/prattparser"
	"strings"
)

type Parser struct {
	source           string
	tokenizer        prattparser.Tokenizer
	currentToken     prattparser.Token
	unaryOpTokens    []string
	binOpTokens      []string
	primitivesTokens []string
}

func (p *Parser) NewParser(source string, tokenizer prattparser.Tokenizer) {
	p.source = source
	p.tokenizer = tokenizer
	p.currentToken, _ = p.tokenizer.Next(p.source, 0)
	p.unaryOpTokens = []string{"-", "+", "!"}
	p.binOpTokens = []string{"-", "+", "/", "*", "**", ".", ">", "<", ">=", "<=", "" +
		"!=", "==", "&&", "||", "in"}
	p.primitivesTokens = []string{"number", "null", "str", "true", "false"}
}

func (p *Parser) eat(tokeType string) {
	if p.currentToken.Kind == tokeType {
		p.currentToken, _ = p.tokenizer.Next(p.source, p.currentToken.End)
	}
}

func (p *Parser) Parse() (node IASTNode) {
	//    expr : term (unaryOp term)*
	var unaryNode UnaryOp

	node = p.term()
	token := p.currentToken

	for ; contains(p.binOpTokens, token.Kind); token = p.currentToken {
		p.eat(token.Kind)
		unaryNode.NewNode(token, p.term())
		node = unaryNode
	}

	return
}

func (p *Parser) term() (node IASTNode) {
	//    term : factor (binaryOp factor)*
	var binaryNode BinOp

	node = p.factor()
	token := p.currentToken

	for ; contains(p.binOpTokens, token.Kind); token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.factor())
		node = binaryNode
	}

	return
}

func (p *Parser) factor() (node IASTNode) {
	//    factor : unaryOp factor | Primitives | LPAREN expr RPAREN

	var unaryNode UnaryOp
	var primitiveNode ASTNode

	token := p.currentToken
	isUnaryOpToken := contains(p.unaryOpTokens, token.Kind)
	isPrimitivesToken := contains(p.primitivesTokens, token.Kind)

	if isUnaryOpToken {
		p.eat(token.Kind)
		unaryNode.NewNode(token, p.factor())
		node = unaryNode
	} else if isPrimitivesToken {
		p.eat(token.Kind)
		primitiveNode.NewNode(token)
		node = primitiveNode
	} else if token.Kind == "(" {
		p.eat("(")
		node = p.Parse()
		p.eat(")")
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

func contains(a []string, x string) bool {
	for _, n := range a {
		if x == n {
			return true
		}
	}
	return false
}
