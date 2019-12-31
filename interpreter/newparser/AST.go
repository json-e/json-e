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
	op          prattparser.Token
}

func (b *BinOp) NewNode(op prattparser.Token, left, right IASTNode) {
	b.Left = left
	b.node.Token = op
	b.op = op
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
	Op   prattparser.Token
	Expr IASTNode
}

func (u *UnaryOp) NewNode(op prattparser.Token, expr IASTNode) {
	u.node.Token = op
	u.Op = op
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
	Builtin string
	node    ASTNode
	Args    []IASTNode
}

func (b *Builtin) NewNode(token prattparser.Token, builtin string, args []IASTNode) {
	b.Builtin = builtin
	b.node.Token = token
	b.Args = args
}

func (b Builtin) GetToken() prattparser.Token {
	return b.node.Token
}
