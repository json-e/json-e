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

class Builtins extends ASTNode {
    constructor(token, builtin, args) {
        super(token);
        this.builtin = builtin;
        this.args = args;
    }
}

exports.ASTNode = ASTNode;
exports.BinOp = BinOp;
exports.UnaryOp = UnaryOp;
exports.Builtins = Builtins;