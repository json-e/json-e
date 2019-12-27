class Interpreter {
    visit(node) {
        let funcName = "visit_"+node.constructor.name;
        return this[funcName](node);
    }

    visit_ASTNode(node) {
        return node.token.value;
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

    interpret(tree) {
        return this.visit(tree);
    }
}

exports.NewInterpreter = Interpreter;