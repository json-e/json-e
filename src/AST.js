class ASTNode {
    constructor(token) {
        this.token = token;
    }
}

class BinOp extends ASTNode {
    constructor(op, left, right) {
        super(op);
        this.left = left;
        this.op = op;
        this.right = right;
    }
}

class UnaryOp extends ASTNode {
    constructor(op, expr) {
        super(op);
        this.op = op;
        this.expr = expr;
    }
}

class Builtin extends ASTNode {
    constructor(token, args) {
        super(token);
        this.args = args;
    }
}

exports.ASTNode = ASTNode;
exports.BinOp = BinOp;
exports.UnaryOp = UnaryOp;
exports.Builtin = Builtin;