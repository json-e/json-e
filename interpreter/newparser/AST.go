package newparser

import "json-e/interpreter/prattparser"

type ASTnodeIntr interface {
	GetToken() prattparser.Token
	GetLeftChild() *ASTnodeIntr
	GetRightChild() *ASTnodeIntr
}

type ASTnode struct {
	Token prattparser.Token
}

func (a *ASTnode) NewNode(token prattparser.Token) {
	a.Token = token
}

func (a ASTnode) GetToken() prattparser.Token {
	return a.Token
}

func (a ASTnode) GetLeftChild() *ASTnodeIntr {
	return nil
}

func (a ASTnode) GetRightChild() *ASTnodeIntr {
	return nil
}

type BinOp struct {
	Left, Right ASTnodeIntr
	node        ASTnode
	op          prattparser.Token
}

func (b *BinOp) NewNode(op prattparser.Token, left, right ASTnodeIntr) {
	b.Left = left
	b.node.Token = op
	b.op = op
	b.Right = right
}

func (b BinOp) GetToken() prattparser.Token {
	return b.node.Token
}

func (b BinOp) GetLeftChild() *ASTnodeIntr {
	return &b.Left
}

func (b BinOp) GetRightChild() *ASTnodeIntr {
	return &b.Right
}

type UnaryOp struct {
	node ASTnode
	Op   prattparser.Token
	Expr ASTnodeIntr
}

func (u *UnaryOp) NewNode(op prattparser.Token, expr ASTnodeIntr) {
	u.node.Token = op
	u.Op = op
	u.Expr = expr
}

func (u UnaryOp) GetToken() prattparser.Token {
	return u.node.Token
}

func (u UnaryOp) GetLeftChild() *ASTnodeIntr {
	return &u.Expr
}

func (u UnaryOp) GetRightChild() *ASTnodeIntr {
	return nil
}

type Builtin struct {
	Builtin string
	node    ASTnode
	Args    []ASTnodeIntr
}

func (b *Builtin) NewNode(token prattparser.Token, builtin string, args []ASTnodeIntr) {
	b.Builtin = builtin
	b.node.Token = token
	b.Args = args
}

func (b Builtin) GetToken() prattparser.Token {
	return b.node.Token
}
