class ASTnode {
    constructor(token) {
        this.token = token;
    }
}

class Term extends ASTnode {
    constructor(token) {
        super(token);
        this.value = token.value;
    }
}

class BinOp extends ASTnode {
    constructor(left, right, op) { 
        super(op);
        this.left = left;
        this.op = op;
        this.right = right;
    }
}

class UnaryOp extends ASTnode { 
    constructor(op, expr) {
        super(op);
        this.op = op;
        this.expr = expr;
    }
}

class Builtins extends ASTnode {
    constructor(builtin, args, token) { 
        super(token);
        this.builtin = builtin;
        this.args = args;
    }
}

exports.ASTnode = ASTnode;
exports.BinOp = BinOp;
exports.UnaryOp = UnaryOp;
exports.Term = Term;
exports.Builtins = Builtins;