class ASTNode {
    constructor(token) {
        this.token = token;
    }
}

class BinOp extends ASTNode {
    constructor(token, left, right) {
        super(token);
        this.left = left;
        this.right = right;
    }
}

class UnaryOp extends ASTNode {
    constructor(token, expr) {
        super(token);
        this.expr = expr;
    }
}

class Builtin extends ASTNode {
    constructor(token, args) {
        super(token);
        this.args = args;
    }
}

class List extends ASTNode {
    constructor(token, list) {
        super(token);
        this.list = list;
    }
}

class ValueAccess extends ASTNode {
    constructor(token, arr, isInterval, left, right) {
        super(token);
        this.isInterval = isInterval;
        this.arr = arr;
        this.left = left;
        this.right = right;

    }
}

class Object extends ASTNode {
    constructor(token,obj) {
        super(token);
        this.obj = obj;
    }
}

exports.ASTNode = ASTNode;
exports.BinOp = BinOp;
exports.UnaryOp = UnaryOp;
exports.Builtin = Builtin;
exports.ArrayAccess = ValueAccess;
exports.List = List;
exports.Object = Object;