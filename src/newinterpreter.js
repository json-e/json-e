const {isFunction} = require("../src/type-utils")

class Interpreter {
    constructor(context) {
        this.context = context;
    }

    visit(node) {
        let funcName = "visit_" + node.constructor.name;
        return this[funcName](node);
    }

    visit_ASTNode(node) {
        switch (node.token.kind) {
            case("number"):
                return +node.token.value;
            case("null"):
                return null;
            case("str"):
                return node.token.value;
            case("true"):
                return true;
            case("false"):
                return false;
        }
    }

    visit_UnaryOp(node) {
        switch (node.token.kind) {
            case ("+"):
                return +this.visit(node.expr);
            case ("-"):
                return -this.visit(node.expr);
            case ("!"):
                return !this.visit(node.expr);
        }
    }

    visit_BinOp(node) {
        switch (node.token.kind) {
            case ("+"):
                return this.visit(node.left) + this.visit(node.right);
            case ("-"):
                return this.visit(node.left) - this.visit(node.right);
            case ("/"):
                return this.visit(node.left) / this.visit(node.right);
            case ("*"):
                return this.visit(node.left) * this.visit(node.right);
            case (">"):
                return this.visit(node.left) > this.visit(node.right);
            case ("<"):
                return this.visit(node.left) < this.visit(node.right);
            case (">="):
                return this.visit(node.left) >= this.visit(node.right);
            case ("<="):
                return this.visit(node.left) <= this.visit(node.right);
            case ("!="):
                return this.visit(node.left) != this.visit(node.right);
            case ("=="):
                return this.visit(node.left) == this.visit(node.right);
            case ("||"):
                return this.visit(node.left) || this.visit(node.right);
            case ("&&"):
                return this.visit(node.left) && this.visit(node.right);
            case ("**"):
                return Math.pow(this.visit(node.left), this.visit(node.right));
        }

    }

    visit_Builtin(node) {
        let args = [];
        let builtin = this.context[node.token.value];
        if (isFunction(builtin)) {
            node.args.forEach(function (item) {
                // this.visit(item)
                args.push(this.visit(item))
            }, this);
            return builtin.apply(null, args);
        }
        return builtin
    }

    interpret(tree) {
        return this.visit(tree);
    }
}

exports.NewInterpreter = Interpreter;