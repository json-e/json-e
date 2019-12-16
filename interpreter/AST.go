package AST

type Tkn struct {
	Value     string
	ValueType string
}

type AST interface {
}

type ASTnode struct {
	Token Tkn
}

func (a *ASTnode) NewNode(token Tkn) {
	a.Token = token
}

type Term struct {
	node  ASTnode
	value string
}

func (t *Term) NewNode(token Tkn) {
	t.node.Token = token
	t.value = token.Value
}

type BinOp struct {
	Left, Right AST
	node        ASTnode
	op          Tkn
}

func (b *BinOp) NewNode(left, right AST, op Tkn) {
	b.Left = left
	b.node.Token = op
	b.op = op
	b.Right = right
}

type UnaryOp struct {
	node ASTnode
	Op   Tkn
	Expr AST
}

func (u *UnaryOp) NewNode(op Tkn, expr AST) {
	u.node.Token = op
	u.Op = op
	u.Expr = expr
}

type Builtin struct {
	Builtin string
	node    ASTnode
	Args    []AST
}

func (b *Builtin) NewNode(builtin string, args []AST, token Tkn) {
	b.Builtin = builtin
	b.node.Token = token
	b.Args = args
}
