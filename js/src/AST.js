class ASTNode {
    constructor(token) {
        this.token = token;
        this.constructorName = 'ASTNode';
    }
}

let Primitive = ASTNode;

class BinOp extends ASTNode {
    constructor(token, left, right) {
        super(token);
        this.constructorName = 'BinOp';
        this.left = left;
        this.right = right;
    }
}

class UnaryOp extends ASTNode {
    constructor(token, expr) {
        super(token);
        this.constructorName = 'UnaryOp';
        this.expr = expr;
    }
}

class FunctionCall extends ASTNode {
    constructor(token, name, args) {
        super(token);
        this.constructorName = 'FunctionCall';
        this.name = name;
        this.args = args;
    }
}

class ContextValue {
    constructor(token) {
        this.token = token;
        this.constructorName = 'ContextValue';
    }
}

class List extends ASTNode {
    constructor(token, list) {
        super(token);
        this.constructorName = 'List';
        this.list = list;
    }
}

class ValueAccess extends ASTNode {
    constructor(token, arr, isInterval, left, right) {
        super(token);
        this.constructorName = 'ValueAccess';
        this.isInterval = isInterval;
        this.arr = arr;
        this.left = left;
        this.right = right;

    }
}

class Object extends ASTNode {
    constructor(token, obj) {
        super(token);
        this.constructorName = 'Object';
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
