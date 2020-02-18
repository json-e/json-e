package parser

type IASTNode interface {
}

type ASTNode struct {
	Token Token
}

func (a *ASTNode) NewNode(token Token) {
	a.Token = token
}

type BinOp struct {
	Left, Right IASTNode
	Token       Token
}

func (b *BinOp) NewNode(token Token, left, right IASTNode) {
	b.Token = token
	b.Left = left
	b.Right = right
}

type UnaryOp struct {
	Token Token
	Expr  IASTNode
}

func (u *UnaryOp) NewNode(token Token, expr IASTNode) {
	u.Token = token
	u.Expr = expr
}

type Builtin struct {
	Token Token
	Args  []IASTNode
}

func (b *Builtin) NewNode(token Token, args []IASTNode) {
	b.Token = token
	b.Args = args
}

type List struct {
	Token Token
	List  []IASTNode
}

func (l *List) NewNode(token Token, list []IASTNode) {
	l.Token = token
	l.List = list
}

type ValueAccess struct {
	Token      Token
	Arr        IASTNode
	IsInterval bool
	Left       IASTNode
	Right      IASTNode
}

func (v *ValueAccess) NewNode(token Token, arr IASTNode, isInterval bool, left, right IASTNode) {
	v.Token = token
	v.Arr = arr
	v.IsInterval = isInterval
	v.Left = left
	v.Right = right
}

type Object struct {
	Token Token
	Obj   map[string]IASTNode
}

func (o *Object) NewNode(token Token, obj map[string]IASTNode) {
	o.Token = token
	o.Obj = obj
}
