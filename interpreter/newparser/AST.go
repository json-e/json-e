package newparser

import "json-e/interpreter/prattparser"

type IASTNode interface {
	GetToken() prattparser.Token
	GetLeftChild() *IASTNode
	GetRightChild() *IASTNode
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

func (a ASTNode) GetLeftChild() *IASTNode {
	return nil
}

func (a ASTNode) GetRightChild() *IASTNode {
	return nil
}

type BinOp struct {
	Left, Right IASTNode
	node        ASTNode
}

func (b *BinOp) NewNode(token prattparser.Token, left, right IASTNode) {
	b.node.Token = token
	b.Left = left
	b.Right = right
}

func (b BinOp) GetToken() prattparser.Token {
	return b.node.Token
}

func (b BinOp) GetLeftChild() *IASTNode {
	return &b.Left
}

func (b BinOp) GetRightChild() *IASTNode {
	return &b.Right
}

type UnaryOp struct {
	node ASTNode
	Expr IASTNode
}

func (u *UnaryOp) NewNode(token prattparser.Token, expr IASTNode) {
	u.node.Token = token
	u.Expr = expr
}

func (u UnaryOp) GetToken() prattparser.Token {
	return u.node.Token
}

func (u UnaryOp) GetLeftChild() *IASTNode {
	return &u.Expr
}

func (u UnaryOp) GetRightChild() *IASTNode {
	return nil
}

type Builtin struct {
	node ASTNode
	Args []IASTNode
}

func (b *Builtin) NewNode(token prattparser.Token, args []IASTNode) {
	b.node.Token = token
	b.Args = args
}

func (b Builtin) GetToken() prattparser.Token {
	return b.node.Token
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
	node       ASTNode
	isInterval bool
	left       IASTNode
	right      IASTNode
}

func (a *ArrayAccess) NewNode(token prattparser.Token, isInterval bool, left, right IASTNode) {
	a.node.Token = token
	a.isInterval = isInterval
	a.left = left
	a.right = right
}

func (a ArrayAccess) GetToken() prattparser.Token {
	return a.node.Token
}

type Object struct {
	node ASTNode
	obj  map[string]interface{}
}

func (o *Object) NewNode(token prattparser.Token, obj map[string]interface{}) {
	o.node.Token = token
	o.obj = obj
}

func (o Object) GetToken() prattparser.Token {
	return o.node.Token
}
