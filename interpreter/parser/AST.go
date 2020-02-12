package parser

type IASTNode interface {
	GetToken() Token
}

type ASTNode struct {
	Token Token
}

func (a *ASTNode) NewNode(token Token) {
	a.Token = token
}

func (a ASTNode) GetToken() Token {
	return a.Token
}

type BinOp struct {
	Left, Right IASTNode
	Node        ASTNode
}

func (b *BinOp) NewNode(token Token, left, right IASTNode) {
	b.Node.Token = token
	b.Left = left
	b.Right = right
}

func (b BinOp) GetToken() Token {
	return b.Node.Token
}

type UnaryOp struct {
	Node ASTNode
	Expr IASTNode
}

func (u *UnaryOp) NewNode(token Token, expr IASTNode) {
	u.Node.Token = token
	u.Expr = expr
}

func (u UnaryOp) GetToken() Token {
	return u.Node.Token
}

type Builtin struct {
	Node ASTNode
	Args []IASTNode
}

func (b *Builtin) NewNode(token Token, args []IASTNode) {
	b.Node.Token = token
	b.Args = args
}

func (b Builtin) GetToken() Token {
	return b.Node.Token
}

type List struct {
	node ASTNode
	List []IASTNode
}

func (l *List) NewNode(token Token, list []IASTNode) {
	l.node.Token = token
	l.List = list
}

func (l List) GetToken() Token {
	return l.node.Token
}

type ValueAccess struct {
	Node       ASTNode
	Arr        IASTNode
	IsInterval bool
	Left       IASTNode
	Right      IASTNode
}

func (v *ValueAccess) NewNode(token Token, arr IASTNode, isInterval bool, left, right IASTNode) {
	v.Node.Token = token
	v.Arr = arr
	v.IsInterval = isInterval
	v.Left = left
	v.Right = right
}

func (v ValueAccess) GetToken() Token {
	return v.Node.Token
}

type Object struct {
	node ASTNode
	Obj  map[string]IASTNode
}

func (o *Object) NewNode(token Token, obj map[string]IASTNode) {
	o.node.Token = token
	o.Obj = obj
}

func (o Object) GetToken() Token {
	return o.node.Token
}
