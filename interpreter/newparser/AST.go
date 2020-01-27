package newparser

import "json-e/interpreter/prattparser"

type IASTNode interface {
	GetToken() prattparser.Token
}

type ASTNode struct {
	Token prattparser.Token
}

func (a *ASTNode) NewNode(token prattparser.Token) {
	a.Token = token
}

func (a ASTNode) GetToken() prattparser.Token {
	return a.Token
}

type BinOp struct {
	Left, Right IASTNode
	Node        ASTNode
}

func (b *BinOp) NewNode(token prattparser.Token, left, right IASTNode) {
	b.Node.Token = token
	b.Left = left
	b.Right = right
}

func (b BinOp) GetToken() prattparser.Token {
	return b.Node.Token
}

type UnaryOp struct {
	Node ASTNode
	Expr IASTNode
}

func (u *UnaryOp) NewNode(token prattparser.Token, expr IASTNode) {
	u.Node.Token = token
	u.Expr = expr
}

func (u UnaryOp) GetToken() prattparser.Token {
	return u.Node.Token
}

type Builtin struct {
	Node ASTNode
	Args []IASTNode
}

func (b *Builtin) NewNode(token prattparser.Token, args []IASTNode) {
	b.Node.Token = token
	b.Args = args
}

func (b Builtin) GetToken() prattparser.Token {
	return b.Node.Token
}

type List struct {
	node ASTNode
	List []IASTNode
}

func (l *List) NewNode(token prattparser.Token, list []IASTNode) {
	l.node.Token = token
	l.List = list
}

func (l List) GetToken() prattparser.Token {
	return l.node.Token
}

type ArrayAccess struct {
	Node       ASTNode
	IsInterval bool
	Left       IASTNode
	Right      IASTNode
}

func (a *ArrayAccess) NewNode(token prattparser.Token, isInterval bool, left, right IASTNode) {
	a.Node.Token = token
	a.IsInterval = isInterval
	a.Left = left
	a.Right = right
}

func (a ArrayAccess) GetToken() prattparser.Token {
	return a.Node.Token
}

type Object struct {
	node ASTNode
	Obj  map[string]IASTNode
}

func (o *Object) NewNode(token prattparser.Token, obj map[string]IASTNode) {
	o.node.Token = token
	o.Obj = obj
}

func (o Object) GetToken() prattparser.Token {
	return o.node.Token
}
