package newparser

import (
	"../prattparser"
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
	p.primitivesTokens = []string{"number", "null", "true", "false"}
}

func (p *Parser) eat(tokeType string) {
	if p.currentToken.Kind == tokeType {
		p.currentToken, _ = p.tokenizer.Next(p.source, p.currentToken.End)
	}
}

func (p *Parser) Parse() (node IASTNode) {
	//    logicalOr : logicalAnd (OR logicalAnd)*
	var binaryNode BinOp

	node = p.logicalAnd()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && token.Kind == "||"; token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.logicalAnd())
		node = binaryNode
	}

	return
}

func (p *Parser) logicalAnd() (node IASTNode) {
	//    logicalAnd : equality (AND equality)*
	var binaryNode BinOp

	node = p.inStatement()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && token.Kind == "&&"; token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.inStatement())
		node = binaryNode
	}

	return
}

func (p *Parser) inStatement() (node IASTNode) {
	//    inStatement : equality (IN equality)*
	var binaryNode BinOp

	node = p.equality()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && token.Kind == "in"; token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.equality())
		node = binaryNode
	}

	return
}

func (p *Parser) equality() (node IASTNode) {
	//    equality : comparison (EQUALITY | INEQUALITY  comparison)*
	var binaryNode BinOp
	operations := []string{"==", "!="}
	node = p.comparison()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && contains(operations, token.Kind); token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.comparison())
		node = binaryNode
	}

	return
}

func (p *Parser) comparison() (node IASTNode) {
	//    comparison : addition (LESS | GREATER | LESSEQUAL | GREATEREQUAL addition)*
	var binaryNode BinOp

	operations := []string{"<", ">", ">=", "<="}
	node = p.addition()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && contains(operations, token.Kind); token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.addition())
		node = binaryNode
	}

	return
}

func (p *Parser) addition() (node IASTNode) {
	//    addition : multiplication (PLUS | MINUS multiplication)*
	var binaryNode BinOp

	operations := []string{"-", "+"}
	node = p.multiplication()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && contains(operations, token.Kind); token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.multiplication())
		node = binaryNode
	}

	return
}

func (p *Parser) multiplication() (node IASTNode) {
	//    multiplication : exponentiation (MUL | DIV exponentiation)*
	var binaryNode BinOp

	operations := []string{"*", "/"}
	node = p.exponentiation()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && contains(operations, token.Kind); token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, node, p.exponentiation())
		node = binaryNode
	}

	return
}

func (p *Parser) exponentiation() (node IASTNode) {
	//    exponentiation : factor (EXP exponentiation)*
	var binaryNode BinOp

	node = p.factor()
	token := p.currentToken

	for ; token != (prattparser.Token{}) && token.Kind == "**"; token = p.currentToken {
		p.eat(token.Kind)
		binaryNode.NewNode(token, p.exponentiation(), node)
		node = binaryNode
	}

	return
}

func (p *Parser) factor() (node IASTNode) {
	// factor : unaryOp factor | primitives | (string | list | builtin) (valueAccess)? | LPAREN expr RPAREN | object
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
	} else if token.Kind == "string" {
		p.eat(token.Kind)
		primitiveNode.NewNode(token)
		node = primitiveNode
		node = p.valueAccess(node)
	} else if token.Kind == "(" {
		p.eat("(")
		node = p.Parse()
		p.eat(")")
	} else if token.Kind == "[" {
		node = p.list()
		node = p.valueAccess(node)
	} else if token.Kind == "{" {
		node = p.object()
	} else if token.Kind == "identifier" {
		node = p.builtins()
		node = p.valueAccess(node)
	}
	return
}

func (p *Parser) builtins() (node IASTNode) {
	//    builtins : (LPAREN (expr ( COMMA expr)*)? RPAREN)? | (DOT ID)*)
	var args []IASTNode
	var token = p.currentToken
	var builtinNode Builtin
	var binOpNode BinOp
	var simpleNode ASTNode
	p.eat("identifier")
	args = nil
	if p.currentToken != (prattparser.Token{}) && p.currentToken.Kind == "(" {
		p.eat("(")
		node = p.Parse()
		args = append(args, node)

		for p.currentToken.Kind == "," {
			p.eat(",")
			node = p.Parse()
			args = append(args, node)
		}
		p.eat(")")
	}
	builtinNode.NewNode(token, args)
	node = builtinNode
	token = p.currentToken
	for token != (prattparser.Token{}) && token.Kind == "." {
		p.eat(".")
		simpleNode.NewNode(p.currentToken)
		p.eat(p.currentToken.Kind)
		binOpNode.NewNode(token, node, simpleNode)
		node = binOpNode
		token = p.currentToken
	}

	return
}

func (p *Parser) list() (node IASTNode) {
	//    list : LSQAREBRAKET (expr ( COMMA expr)*)? RSQAREBRAKET)
	var list []IASTNode
	var listNode List
	var token = p.currentToken
	p.eat("[")

	if p.currentToken.Kind != "]" {
		node = p.Parse()
		list = append(list, node)

		for p.currentToken.Kind == "," {
			p.eat(",")
			node = p.Parse()
			list = append(list, node)
		}
	}
	p.eat("]")
	listNode.NewNode(token, list)
	node = listNode
	return
}

func (p *Parser) valueAccess(node IASTNode) IASTNode {
	//    valueAccess : LSQAREBRAKET expr |(expr? SEMI expr?)  RSQAREBRAKET)
	var arrayNode ValueAccess
	var left, right IASTNode
	token := p.currentToken
	isInterval := false
	p.eat("identifier")
	token = p.currentToken
	for token != (prattparser.Token{}) && token.Kind == "[" {
		p.eat("[")
		if p.currentToken.Kind != ":" {
			left = p.Parse()
		}
		if p.currentToken.Kind == ":" {
			isInterval = true
			p.eat(":")
			if p.currentToken.Kind != "]" {
				right = p.Parse()
			}
		}

		p.eat("]")
		arrayNode.NewNode(token, node, isInterval, left, right)
		node = arrayNode
		token = p.currentToken
	}
	return node
}

func (p *Parser) object() (node IASTNode) {
	//    object : LCURLYBRACE ( STR | ID SEMI expr (COMMA STR | ID SEMI expr)*)? RCURLYBRACE (DOT ID)?
	var objectNode Object
	var binOpNode BinOp
	var simpleNode ASTNode
	obj := make(map[string]IASTNode)
	token := p.currentToken
	p.eat("{")

	for p.currentToken.Kind == "string" || p.currentToken.Kind == "identifier" {
		key := p.currentToken.Value
		if p.currentToken.Kind == "string" {
			key = parseString(key)
		}
		p.eat(p.currentToken.Kind)
		p.eat(":")
		value := p.Parse()
		obj[key] = value
		if p.currentToken.Kind == "}" {
			break
		} else {
			p.eat(",")
		}
	}
	p.eat("}")
	objectNode.NewNode(token, obj)
	node = objectNode
	token = p.currentToken
	for token != (prattparser.Token{}) && token.Kind == "." {
		p.eat(".")
		simpleNode.NewNode(p.currentToken)
		p.eat(p.currentToken.Kind)
		binOpNode.NewNode(token, node, simpleNode)
		node = binOpNode
		token = p.currentToken
	}
	return
}

func parseString(s string) string {
	return s[1 : len(s)-1]
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
