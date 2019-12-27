class Interpreter {
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
            case ():
                return this.visit(node.left) || this.visit(node.right);
            case ("&&"):
                return this.visit(node.left) && this.visit(node.right);
            case ("**"):
                return Math.pow(this.visit(node.left), this.visit(node.right));
        }
    }

    interpret(tree) {
        return this.visit(tree);
    }
}

exports.NewInterpreter = Interpreter;