class ASTNode {
    constructor(token) {
        this.token = token;
    }
}

let Primitive = ASTNode;

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

class FunctionCall extends ASTNode {
    constructor(token, name, args) {
        super(token);
        this.name = name;
        this.args = args;
    }
}

class ContextValue {
    constructor(token) {
        this.token = token;
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
    constructor(token, obj) {
        super(token);
        this.obj = obj;
    }
}

exports.ASTNode = ASTNode;
exports.BinOp = BinOp;
exports.UnaryOp = UnaryOp;
exports.Primitive = Primitive;
exports.FunctionCall = FunctionCall;
exports.ContextValue = ContextValue;
exports.ValueAccess = ValueAccess;
exports.List = List;
exports.Object = Object;